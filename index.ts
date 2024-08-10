import express, { Request, Response } from "express";
import cors from "cors";
import axios from "axios";
import rateLimit from "express-rate-limit";

const app = express();
const port = process.env.PORT || 12712;

app.use(cors());

const MINUTE_MAX_REQUESTS = 20;
const SIX_HOURS_MAX_REQUESTS = 500;
const MAX_SIZE = 1 * 1000 * 1000;
const TOO_LARGE_RESPONSE = {
	code: 413,
	message: "Response data is too large",
	details:
		"We are sorry, but the response you request in this proxy is too large. To prevent abuse, we blocked the request. Please try again later. We apologize for the inconvenience. If you are a developer and want unrestricted access, you can consider self-deployment. The source code is available at https://github.com/alikia2x/cors-proxy, feel free to hack it and deploy yours."
};

const RATE_LIMIT_EXCEEDED = {
	code: 429,
	message: "Too many requests, please try again later.",
	details:
		"We are sorry, but your IP sent more than the allowed number of requests. To prevent abuse, we blocked the request. Please try again later. We apologize for the inconvenience. If you are a developer and want unrestricted access, you can consider self-deployment. The source code is available at https://github.com/alikia2x/cors-proxy, feel free to hack it and deploy yours."
};

const minuteLimiter = rateLimit({
	windowMs: 60 * 1000,
	max: MINUTE_MAX_REQUESTS,
	message: RATE_LIMIT_EXCEEDED
});

const sixHourLimiter = rateLimit({
	windowMs: 6 * 60 * 60 * 1000,
	max: SIX_HOURS_MAX_REQUESTS,
	message: RATE_LIMIT_EXCEEDED
});

app.get("/", minuteLimiter, sixHourLimiter, async (req: Request, res: Response) => {
	const response = {
		code: 200,
		message: "Hi! This is a free CORS proxy for anyone to use.",
		usage: "Put your URL after ours, and it'll give you a CORS-free response.",
		url: "https://cors.a2x.pub/",
		example: "https://cors.a2x.pub/https://api.github.com/users/alikia2x",
		source: "https://github.com/alikia2x/cors-proxy"
	};
	res.json(response);
});

app.get("/*", minuteLimiter, sixHourLimiter, async (req: Request, res: Response) => {
	const targetUrl = req.path.slice(1);

	if (!targetUrl) {
		return res.status(400).json({
			code: 400,
			message: "Bad request",
			details: "URL parameter is required"
		});
	}

	try {
		const response = await axios.get(targetUrl)
		//@ts-ignore
		if (!(response.headers.getContentType() as string).startsWith("application/json")) {
			return res.status(400).json({
				code: 400,
				message: "Bad request",
				details: "The response data is not in JSON format, which is not allowed in order to prevent abuse. We only accept API request proxy."
			});
		}
		try {
			if (response.data.toString().length > MAX_SIZE) {
				return res.status(413).json(TOO_LARGE_RESPONSE);
			}
		}
		catch (error: any) {
			return res.send(response.data);
		}
		return res.send(response.data);
	} catch (error: any) {
		return res.status(500).json({
			code: 500,
			message: "Internal server error",
			details: "Error fetching the URL"
		});
	}
});

app.listen(port, () => {
	console.log(`CORS proxy server is running at http://localhost:${port}`);
});
