import express, { Request, Response } from "express";
import cors from "cors";
import axios from "axios";
import rateLimit from "express-rate-limit";
import { GracefulShutdownManager } from "@moebius/http-graceful-shutdown";
import { URL } from "url";
import ipRangeCheck from "ip-range-check";
import dns from "dns/promises";

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

const TYPE_NOT_ALLOED = {
	code: 400,
	message: "Bad request",
	details:
		"The response data is not in JSON format, which is not allowed in order to prevent abuse. We only accept API request proxy."
}

const HELLO_MSG = {
	code: 200,
	message: "Hi! This is a free CORS proxy for anyone to use.",
	usage: "Put your URL after ours, and it'll give you a CORS-free response.",
	url: "https://cors.a2x.pub/",
	example: "https://cors.a2x.pub/https://api.github.com/users/alikia2x",
	source: "https://github.com/alikia2x/cors-proxy"
};

const ACCESS_DENIED = {
	code: 403,
	message: "Forbidden",
	details: "Access to the requested URL is blocked"
}

const MISSING_URL_PARAM = {
	code: 400,
	message: "Bad request",
	details: "URL parameter is required"
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

// List of IP ranges to block
const blockedRanges = [
    '192.168.0.0/16',
    '10.0.0.0/8',
    'fe80::/10',
	'fc00::/7',
	'127.0.0.0/8',
	'::1/128',
	'172.16.0.0/12',
	'169.254.0.0/16',
	'fd00::/8',
	'100.64.0.0/10',
];

app.get("/", minuteLimiter, sixHourLimiter, async (req: Request, res: Response) => {
    const response = HELLO_MSG;
    res.json(response);
});

app.get("/*", minuteLimiter, sixHourLimiter, async (req: Request, res: Response) => {
    const targetUrl = req.path.slice(1);

    if (!targetUrl) {
        return res.status(400).json(MISSING_URL_PARAM);
    }

	try {
		const parsedUrl = new URL(targetUrl);
        const hostname = parsedUrl.hostname;

        // Perform DNS resolution
        const addresses = await dns.resolve4(hostname).catch(() => []);
        const ipv6Addresses = await dns.resolve6(hostname).catch(() => []);

        // Combine all IP addresses
        const allAddresses = [...addresses, ...ipv6Addresses];

        // Check if any resolved IP address falls within blocked ranges
        const isBlocked = allAddresses.some((address) => ipRangeCheck(address, blockedRanges));

        if (hostname === 'localhost' || isBlocked) {
            return res.status(403).json(ACCESS_DENIED);
        }
	}
	catch {
		return res.status(403).json(ACCESS_DENIED);
	}

	try {
		const headResponse = await axios.head(targetUrl, {
			maxRedirects: 0
		});
		//@ts-ignore
		if (!(headResponse.headers.getContentType() as string).startsWith("application/json")) {
            return res.status(400).json(TYPE_NOT_ALLOED);
        }
		//@ts-ignore
		if (!(headResponse.headers.getContentLength() as number) > MAX_SIZE) {
			return res.status(413).json(TOO_LARGE_RESPONSE);
		}
	}
	catch {
		;
	}

    try {
        const response = await axios.get(targetUrl, {
            maxRedirects: 0
        });
        //@ts-ignore
        if (!(response.headers.getContentType() as string).startsWith("application/json")) {
            return res.status(400).json(TYPE_NOT_ALLOED);
        }
        try {
            if (response.data.toString().length > MAX_SIZE) {
                return res.status(413).json(TOO_LARGE_RESPONSE);
            }
        } catch (error: any) {
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

const server = app.listen(port, () => {
    console.log(`CORS proxy server is running at http://localhost:${port}`);
});

const shutdownManager = new GracefulShutdownManager(server);

process.on("SIGTERM", () => {
    shutdownManager.terminate(() => {
        console.log("Server is gracefully terminated");
    });
});

process.on("uncaughtException", (err) => {
    shutdownManager.terminate(() => {
        console.log("Server is gracefully terminated");
    });
});

process.on("unhandledRejection", (reason, promise) => {
    shutdownManager.terminate(() => {
        console.log("Server is gracefully terminated");
    });
});
