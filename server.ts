import express from "express";
import http from "http";
import { createServer as createViteServer } from "vite";
import path from "path";
import { createRequire } from "module";
import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

const require = createRequire(import.meta.url);
const { app: backendApp } = require("./backend/server.cjs");
const { requireAuth } = require("./backend/middleware/auth.js");
const { paymentRepository, platformRepository } = require("./backend/lib/repositories.js");
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

const addRootSecurityHeaders = (_req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
};

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  const HOST = process.env.HOST || "0.0.0.0";

  app.disable("x-powered-by");
  app.set("trust proxy", true);
  app.use(express.json());
  app.use(addRootSecurityHeaders);
  app.use("/backend", backendApp);

  app.get("/healthz", async (_req, res) => {
    const response = await fetch(`http://127.0.0.1:${PORT}/backend/api/health`).catch(() => null);
    const payload = response ? await response.json() : { status: "unknown" };
    res.json({
      status: "ok",
      app: "frontend-server",
      backend: payload,
      timestamp: new Date().toISOString(),
    });
  });

  const resolveBaseUrl = (origin?: string) => {
    let baseUrl = process.env.APP_URL || origin || "http://localhost:3000";
    if (baseUrl.includes("ais-dev-")) {
      baseUrl = baseUrl.replace("ais-dev-", "ais-pre-");
    }
    return baseUrl;
  };

  app.post("/api/stripe/course-checkout", requireAuth, async (req: any, res) => {
    try {
      if (!stripe) {
        return res.status(503).json({ error: "Stripe is not configured on this environment." });
      }

      const { courseId, courseTitle, price, origin } = req.body || {};
      if (!courseId || !courseTitle || !price) {
        return res.status(400).json({ error: "courseId, courseTitle, and price are required." });
      }

      const userId = req.user?.id;
      const payment = await paymentRepository.createCheckout({
        userId,
        amount: price,
        currency: "INR",
        item: courseTitle,
      });
      const baseUrl = resolveBaseUrl(origin);

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "inr",
              product_data: {
                name: courseTitle,
                description: `Enrollment for ${courseTitle}`,
              },
              unit_amount: price * 100, // Stripe expects amount in paise/cents
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${baseUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}&course_id=${courseId}&payment_id=${payment._id}`,
        cancel_url: `${baseUrl}/payment-cancel`,
        metadata: {
          courseId,
          userId,
          paymentId: payment._id,
          accessType: "course",
        },
      });

      res.json({ url: session.url, sessionId: session.id, paymentId: payment._id });
    } catch (error: any) {
      console.error("Stripe Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/stripe/confirm-course-payment", requireAuth, async (req: any, res) => {
    try {
      if (!stripe) {
        return res.status(503).json({ error: "Stripe is not configured on this environment." });
      }

      const { sessionId, courseId } = req.body || {};
      if (!sessionId || !courseId) {
        return res.status(400).json({ error: "sessionId and courseId are required." });
      }

      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const metadata = session.metadata || {};

      if (session.payment_status !== "paid") {
        return res.status(409).json({ error: `Payment is ${session.payment_status || "not completed"}.` });
      }

      if (metadata.userId !== req.user?.id || metadata.courseId !== courseId) {
        return res.status(403).json({ error: "Stripe session does not belong to this student/course." });
      }

      if (!metadata.paymentId) {
        return res.status(400).json({ error: "Stripe session is missing payment metadata." });
      }

      await paymentRepository.handleWebhook({
        event: "payment.completed",
        paymentId: metadata.paymentId,
        status: "paid",
        provider: "stripe",
        sessionId,
      });

      const enrollment = await platformRepository.enroll({
        userId: req.user.id,
        courseId,
        source: "stripe",
        accessType: "course",
      });

      return res.json({
        status: "paid",
        enrollment,
        courseId,
        paymentId: metadata.paymentId,
      });
    } catch (error: any) {
      console.error("Stripe confirmation error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Dedicated success page to avoid 403 errors in direct tab access
  app.get("/payment-success", (req, res) => {
    const courseId = req.query.course_id;
    const sessionId = req.query.session_id;
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Successful | EduMaster</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            justify-content: center; 
            height: 100vh; 
            margin: 0; 
            background-color: #f3f4f6; 
            color: #111827; 
          }
          .card { 
            background: white; 
            padding: 2.5rem; 
            border-radius: 1.5rem; 
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); 
            text-align: center; 
            max-width: 450px; 
            width: 90%;
          }
          .icon {
            width: 64px;
            height: 64px;
            background-color: #d1fae5;
            color: #059669;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 1.5rem;
          }
          h1 { font-size: 1.875rem; font-weight: 800; margin-bottom: 1rem; color: #111827; }
          p { color: #4b5563; line-height: 1.625; margin-bottom: 2rem; }
          .btn { 
            display: inline-block;
            padding: 0.875rem 2rem; 
            background-color: #2563eb; 
            color: white; 
            border-radius: 0.75rem; 
            text-decoration: none; 
            font-weight: 700; 
            transition: background-color 0.2s;
            border: none;
            cursor: pointer;
            font-size: 1rem;
          }
          .btn:hover { background-color: #1d4ed8; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <h1>Payment Successful!</h1>
          <p>Thank you for your enrollment. Your course has been activated. You can now close this tab and return to the EduMaster app to start learning.</p>
          <button onclick="window.close()" class="btn">Close This Tab</button>
        </div>
        <script>
          // Try to notify the opener if it's a popup
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'STRIPE_PAYMENT_SUCCESS',
              courseId: '${courseId}',
              sessionId: '${sessionId}',
              paymentId: '${req.query.payment_id || ""}'
            }, '*');
          }
        </script>
      </body>
      </html>
    `);
  });

  app.get("/payment-cancel", (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Cancelled | EduMaster</title>
        <style>
          body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f9fafb; }
          .card { background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); text-align: center; max-width: 400px; }
          h1 { color: #ef4444; margin-bottom: 1rem; }
          p { color: #4b5563; margin-bottom: 2rem; }
          .btn { padding: 0.75rem 1.5rem; background: #374151; color: white; border-radius: 0.5rem; text-decoration: none; font-weight: bold; border: none; cursor: pointer; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Payment Cancelled</h1>
          <p>The payment process was cancelled. You can close this tab and try again from the app.</p>
          <button onclick="window.close()" class="btn">Close Tab</button>
        </div>
      </body>
      </html>
    `);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === "true" ? false : undefined,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = http.createServer(app);

  server.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
  });

  const shutdown = (signal: string) => {
    console.log(`Received ${signal}. Shutting down gracefully...`);
    server.close(() => process.exit(0));
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

startServer();
