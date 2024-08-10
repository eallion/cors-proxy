import express, { Request, Response } from "express";
import cors from "cors";
import axios from "axios";

const app = express();
// easteregg
const port = process.env.PORT || 12712;

app.use(cors());

app.get("/*", async (req: Request, res: Response) => {
	const targetUrl = req.path.slice(1);

	if (!targetUrl) {
		return res.status(400).send("URL parameter is required");
	}

	try {
		const response = await axios.get(targetUrl);
		res.send(response.data);
	} catch (error) {
		res.status(500).send("Error fetching the URL");
	}
});

app.listen(port, () => {
	console.log(`CORS proxy server is running at http://localhost:${port}`);
});
