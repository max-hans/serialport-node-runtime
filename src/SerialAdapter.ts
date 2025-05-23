import { SerialPort, ReadlineParser } from "serialport";
import { EventEmitter } from "node:events";

export class SerialAdapter extends EventEmitter {
	private serialPort: SerialPort | null = null;
	private parser: ReadlineParser | null = null;
	private isConnecting = false;
	private connectionAttempts = 0;
	private currentVendorId: string | null = null;
	private currentProductId: string | null = null;

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

				const newParser = new ReadlineParser(/* { delimiter: "\r\n" } */);
				this.parser = newParser;
				this.serialPort.pipe(this.parser);

				this.parser.on("data", (data: string) => {
					this.emit("data", data);
					console.log("data", data);
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

	async write(data: string[]) {
		if (!this.serialPort) {
			throw new Error("Serial port not initialized");
		}

		const cleaned = data.map((d) => {
			const fragments = d.split(";");
			return fragments[0].trim();
		});

		console.log("writing", cleaned);
		this.serialPort.write(`${cleaned.join("\n")}\n`);
	}
}
