import { SerialPort, ReadlineParser } from "serialport";
import { EventEmitter } from "node:events";

interface QueuedCommand {
	command: string;
	resolve: () => void;
	reject: (error: Error) => void;
	timeout: NodeJS.Timeout;
}

export class SerialAdapter extends EventEmitter {
	private serialPort: SerialPort | null = null;
	private parser: ReadlineParser | null = null;
	private isConnecting = false;
	private connectionAttempts = 0;
	private currentVendorId: string | null = null;
	private currentProductId: string | null = null;

	// Flow control properties
	private commandQueue: string[] = [];
	private pendingCommands: QueuedCommand[] = [];
	private readonly MAX_PENDING = 4; // Adjust based on your printer's buffer
	private readonly COMMAND_TIMEOUT = 10000; // 10 seconds
	private isProcessingQueue = false;

	private readonly RETRY_DELAY = 2000; // 2 seconds

	public ready = false;

	async init(vendorId: string, productId: string) {
		if (this.isConnecting) {
			throw new Error("Connection already in progress");
		}

		this.currentVendorId = vendorId;
		this.currentProductId = productId;
		this.isConnecting = true;
		this.connectionAttempts = 0;

		try {
			await this.connectionLoop(vendorId, productId);
		} finally {
			this.isConnecting = false;
		}
	}

	private async connectionLoop(
		vendorId: string,
		productId: string,
	): Promise<void> {
		while (true) {
			try {
				this.serialPort = await this.tryToOpen(vendorId, productId);
				if (!this.serialPort) {
					throw new Error("Failed to create serial port");
				}

				await this.setupPort();
				return;
			} catch (error) {
				this.connectionAttempts++;
				console.log(
					`Connection attempt ${this.connectionAttempts} failed:`,
					error,
				);

				await new Promise((resolve) => setTimeout(resolve, this.RETRY_DELAY));
			}
		}
	}

	private async setupPort(): Promise<void> {
		if (!this.serialPort) {
			throw new Error("Serial port not initialized");
		}

		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error("Port setup timeout"));
			}, 5000);

			if (!this.serialPort) {
				throw new Error("Serial port not available");
			}

			this.serialPort.on("open", () => {
				if (!this.serialPort) {
					throw new Error("Serial port not initialized");
				}

				const newParser = new ReadlineParser({ delimiter: "\n" });
				this.parser = newParser;
				this.serialPort.pipe(this.parser);

				this.parser.on("data", (data: string) => {
					this.handleSerialData(data);
				});

				this.ready = true;
				console.log("Serial port initialized");
				clearTimeout(timeout);
				resolve();
			});

			this.serialPort.on("error", async (error: Error) => {
				this.emit("error", error);
				this.ready = false;
				console.log("Serial port error", error);
				clearTimeout(timeout);

				// Clear pending commands on error
				this.clearPendingCommands(error);

				// Start reconnection if we have stored vendor/product IDs
				if (this.currentVendorId && this.currentProductId) {
					this.isConnecting = true;
					this.connectionAttempts = 0;
					try {
						await this.connectionLoop(
							this.currentVendorId,
							this.currentProductId,
						);
					} catch (reconnectError) {
						console.error("Reconnection failed:", reconnectError);
					} finally {
						this.isConnecting = false;
					}
				}
				reject(error);
			});

			this.serialPort.on("close", async () => {
				this.emit("close");
				this.ready = false;
				console.log("Serial port closed");
				clearTimeout(timeout);

				// Clear pending commands on close
				this.clearPendingCommands(new Error("Port closed"));

				// Start reconnection if we have stored vendor/product IDs
				if (this.currentVendorId && this.currentProductId) {
					this.isConnecting = true;
					this.connectionAttempts = 0;
					try {
						await this.connectionLoop(
							this.currentVendorId,
							this.currentProductId,
						);
					} catch (reconnectError) {
						console.error("Reconnection failed:", reconnectError);
					} finally {
						this.isConnecting = false;
					}
				}
				reject(new Error("Port closed during setup"));
			});

			this.serialPort.open();
		});
	}

	private handleSerialData(data: string): void {
		const trimmedData = data.trim();
		this.emit("data", trimmedData);
		console.log("Received:", trimmedData);

		// Handle flow control responses
		if (this.isOkResponse(trimmedData)) {
			this.handleOkResponse();
		} else if (this.isErrorResponse(trimmedData)) {
			this.handleErrorResponse(trimmedData);
		}
	}

	private isOkResponse(data: string): boolean {
		const lowerData = data.toLowerCase();
		return lowerData.includes("ok") || lowerData === "ok";
	}

	private isErrorResponse(data: string): boolean {
		const lowerData = data.toLowerCase();
		return lowerData.includes("error") || lowerData.includes("!!");
	}

	private handleOkResponse(): void {
		if (this.pendingCommands.length > 0) {
			const command = this.pendingCommands.shift();
			if (command) {
				clearTimeout(command.timeout);
				command.resolve();
				console.log(`Command acknowledged: ${command.command}`);
			}
		}
		this.processQueue();
	}

	private handleErrorResponse(errorData: string): void {
		if (this.pendingCommands.length > 0) {
			const command = this.pendingCommands.shift();
			if (command) {
				clearTimeout(command.timeout);
				command.reject(new Error(`Printer error: ${errorData}`));
				console.error(`Command failed: ${command.command} - ${errorData}`);
			}
		}
		this.processQueue();
	}

	private clearPendingCommands(error: Error): void {
		while (this.pendingCommands.length > 0) {
			const command = this.pendingCommands.shift();
			if (command) {
				clearTimeout(command.timeout);
				command.reject(error);
			}
		}
	}

	private processQueue(): void {
		if (this.isProcessingQueue || !this.ready || !this.serialPort) {
			return;
		}

		this.isProcessingQueue = true;

		while (
			this.commandQueue.length > 0 &&
			this.pendingCommands.length < this.MAX_PENDING
		) {
			const command = this.commandQueue.shift();
			if (command) {
				this.sendCommand(command);
			}
		}

		this.isProcessingQueue = false;
	}

	private sendCommand(command: string): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.serialPort || !this.ready) {
				reject(new Error("Serial port not ready"));
				return;
			}

			const timeout = setTimeout(() => {
				// Remove from pending commands if timeout occurs
				const index = this.pendingCommands.findIndex(
					(c) => c.command === command,
				);
				if (index !== -1) {
					this.pendingCommands.splice(index, 1);
				}
				console.log(`Command timeout: ${command}`);
			}, this.COMMAND_TIMEOUT);

			const queuedCommand: QueuedCommand = {
				command,
				resolve,
				reject,
				timeout,
			};

			this.pendingCommands.push(queuedCommand);
			this.serialPort.write(`${command}\n`);
			console.log(`Sent: ${command} (pending: ${this.pendingCommands.length})`);
		});
	}

	private async tryToOpen(
		vendorId: string,
		productId: string,
	): Promise<SerialPort | null> {
		const ports = await SerialPort.list();
		const port = ports.find(
			(port) => port.vendorId === vendorId && port.productId === productId,
		);

		if (!port) {
			throw new Error("Port not found");
		}

		return new SerialPort({
			path: port.path,
			baudRate: 115200,
			autoOpen: false,
		});
	}

	async write(data: string[]): Promise<void> {
		if (!this.serialPort || !this.ready) {
			throw new Error("Serial port not ready");
		}

		const cleaned = data
			.map((d) => {
				const fragments = d.split(";");
				return fragments[0].trim();
			})
			.filter((cmd) => cmd.length > 0); // Remove empty commands

		/* console.log("Queueing commands:", cleaned); */

		// Add commands to queue
		this.commandQueue.push(...cleaned);

		// Start processing queue
		this.processQueue();

		// Wait for all commands to complete
		return this.waitForQueueEmpty();
	}

	private waitForQueueEmpty(): Promise<void> {
		return new Promise((resolve) => {
			const checkQueue = () => {
				if (
					this.commandQueue.length === 0 &&
					this.pendingCommands.length === 0
				) {
					resolve();
				} else {
					setTimeout(checkQueue, 100);
				}
			};
			checkQueue();
		});
	}

	// Method to send a single command and wait for response
	async sendSingleCommand(command: string): Promise<void> {
		if (!this.serialPort || !this.ready) {
			throw new Error("Serial port not ready");
		}

		const cleaned = command.split(";")[0].trim();
		if (cleaned.length === 0) {
			return;
		}

		this.commandQueue.push(cleaned);
		this.processQueue();

		return this.waitForQueueEmpty();
	}

	// Method to check if the adapter is busy processing commands
	isBusy(): boolean {
		return this.commandQueue.length > 0 || this.pendingCommands.length > 0;
	}

	// Method to clear the command queue (emergency stop)
	clearQueue(): void {
		this.commandQueue = [];
		this.clearPendingCommands(new Error("Queue cleared by user"));
	}

	// Method to get queue status
	getQueueStatus(): { queued: number; pending: number } {
		return {
			queued: this.commandQueue.length,
			pending: this.pendingCommands.length,
		};
	}
}
