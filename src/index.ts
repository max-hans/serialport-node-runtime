import { Hono } from "hono";
import { SerialAdapter } from "./SerialAdapter";
import { serve } from "@hono/node-server";
const vendorId = process.env.VENDOR_ID;
const productId = process.env.PRODUCT_ID;

if (!vendorId || !productId) {
	throw new Error("VENDOR_ID and PRODUCT_ID must be set");
}

const serialAdapter = new SerialAdapter();

const run = async () => {
	await serialAdapter.init(vendorId, productId);

	await serialAdapter.write(["G28"]);
};

run();

const app = new Hono();
app.get("/", (c) => c.text("Hello!"));

app.get("/status", (c) => {
	if (!serialAdapter.ready) {
		return c.json({ status: "not initialized" }, 500);
	}

	return c.json({ status: "initialized" });
});

app.post("/send", async (c) => {
	if (!serialAdapter.ready) {
		return c.json({ status: "not initialized" }, 500);
	}

	const { data } = await c.req.json();
	try {
		await serialAdapter.write(data);
		return c.json({ status: "success" });
	} catch (error) {
		return c.json({ status: "error", error: (error as Error).message }, 500);
	}
});

serve({ fetch: app.fetch, port: 3123 });
