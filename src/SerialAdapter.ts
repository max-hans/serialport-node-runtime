import { SerialPort, ReadlineParser } from "serialport";
import { EventEmitter } from "node:events";
export class SerialAdapter extends EventEmitter {
	private serialPort: SerialPort | null = null;
	private parser: ReadlineParser | null = null;

	public ready = false;

	async init(vendorId: string, productId: string) {
		const ports = await SerialPort.list();
		const port = ports.find(
			(port) => port.vendorId === vendorId && port.productId === productId,
		);

		if (!port) {
			throw new Error("Port not found");
		}
		this.serialPort = new SerialPort({ path: port.path, baudRate: 115200 });

		this.serialPort.on("open", () => {
			const newParser = new ReadlineParser({ delimiter: "\r\n" });
			this.parser = newParser;
			if (this.serialPort) {
				this.serialPort.pipe(this.parser);

				this.parser.on("data", (data) => {
					this.emit("data", data);
				});
			}
		});

		this.serialPort.on("error", (error) => {
			this.emit("error", error);
			this.ready = false;
			console.log("Serial port error", error);
		});

		this.serialPort.on("close", () => {
			this.emit("close");
			this.ready = false;
			console.log("Serial port closed");
		});

		this.ready = true;
		console.log("Serial port initialized");
	}

	async write(data: string[]) {
		if (this.serialPort) {
			const cleaned = data.map((d) => d.replace(/\r\n/g, "").trim());
			this.serialPort.write(`${cleaned.join("\n")}\n`);
		} else {
			throw new Error("Serial port not initialized");
		}
	}
}
