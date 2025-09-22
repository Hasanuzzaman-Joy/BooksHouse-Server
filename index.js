require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");
const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
const nodemailer = require("nodemailer");
const cors = require("cors");

// Middlewares
app.use(cors());
app.use(express.json());

const verifyToken = async (req, res, next) => {
  const authHeaders = req.headers.authorization;
  if (!authHeaders || !authHeaders.startsWith("Bearer ")) {
    return res
      .status(401)
      .send({ message: "Access denied: Invalid token provided." });
  }

  const token = authHeaders.split(" ")[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.decoded = decoded;
  } catch (error) {
    return res
      .status(401)
      .send({ message: "Access denied: Failed to verify token." });
  }
  next();
};

const verifyTokenEmail = async (req, res, next) => {
  if (req.query.email) {
    if (req.query.email !== req.decoded.email) {
      res.status(403).send({
        message: "Access forbidden: Email does not match authenticated user.",
      });
    }
  }
  next();
};

// Firebase
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString(
  "utf-8"
);
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// MongoDB
const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const bookCollections = client.db("booksDB").collection("books");
    const reviewCollections = client.db("booksDB").collection("reviews");

    // All Books with Pagination and Filtering
    app.get("/all-books", async (req, res) => {
      const filteredStatus = req.query.filteredStatus;
      const searchParams = req.query.searchParams;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 9;
      const skip = (page - 1) * limit;

      const filter = {};
      if (filteredStatus) filter.reading_status = filteredStatus;
      if (searchParams) {
        filter.$or = [
          { book_title: { $regex: searchParams, $options: "i" } },
          { book_author: { $regex: searchParams, $options: "i" } },
        ];
      }

      const totalBooks = await bookCollections.countDocuments(filter);
      const result = await bookCollections
        .find(filter)
        .skip(skip)
        .limit(limit)
        .toArray();

      res.json({
        books: result,
        totalBooks,
        currentPage: page,
        totalPages: Math.ceil(totalBooks / limit),
      });
    });

    // User's Books
    app.get("/books", verifyToken, verifyTokenEmail, async (req, res) => {
      const email = req.query.email;
      let query = { email: email };
      const result = await bookCollections.find(query).toArray();
      res.send(result);
    });

    // Single Book
    app.get("/book/:id", async (req, res) => {
      const id = req.params.id;
      let filter = { _id: new ObjectId(id) };
      const result = await bookCollections.findOne(filter);
      res.send(result);
    });

    // Get Book for Update with Authorization
    app.get(
      "/update-book/:id",
      verifyToken,
      verifyTokenEmail,
      async (req, res) => {
        const id = req.params.id;
        let filter = { _id: new ObjectId(id) };
        const result = await bookCollections.findOne(filter);

        if (!result) {
          return res.status(401).send({ message: "Book not found" });
        }

        if (result.email !== req.decoded.email) {
          return res.status(403).send({
            message:
              "Access forbidden: Email does not match authenticated user.",
          });
        }

        res.send(result);
      }
    );

    // Popular Books
    app.get("/popular-books", async (req, res) => {
      const allBooks = await bookCollections.find().toArray();
      allBooks.sort(
        (a, b) => (b.upvote?.length || 0) - (a.upvote?.length || 0)
      );
      const result = allBooks.slice(0, 6);
      res.send(result);
    });

    // Book Categories
    app.get("/categories/:category", async (req, res) => {
      const category = req.params.category;
      const filter = {
        book_category: { $regex: new RegExp(`^${category}$`, "i") },
      };
      const result = await bookCollections.find(filter).toArray();
      res.send(result);
    });

    // Reviews
    app.get("/all-reviews/:id", async (req, res) => {
      const id = req.params.id;
      let filter = { reviewedBookId: id };
      const result = await reviewCollections.find(filter).toArray();
      res.send(result);
    });

    // Add Book
    app.post("/add-book", verifyToken, verifyTokenEmail, async (req, res) => {
      const data = req.body;
      if (data.email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden: Email mismatch" });
      }
      data.total_page = parseInt(data.total_page);
      const result = await bookCollections.insertOne(data);
      res.send(result);
    });

    // Add Review
    app.post("/reviews", async (req, res) => {
      const review = req.body;
      const email = review.reviewerEmail;
      const commentedBook = review.reviewedBookId;

      const existingReview = await reviewCollections.findOne({
        reviewerEmail: email,
        reviewedBookId: commentedBook,
      });

      if (existingReview) {
        return res.send({
          message: "You have already added a review for this book",
        });
      }

      const result = await reviewCollections.insertOne(review);
      res.send(result);
    });

    // Contact form
    app.post("/contact", async (req, res) => {
      const { name, email, message } = req.body;

      try {
        const transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 465,
          secure: true,
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        // Email options
        const mailOptions = {
          from: `"BooksHouse Contact" <${process.env.EMAIL_USER}>`,
          to: process.env.EMAIL_USER,
          subject: `BooksHouse Form Message from ${name}`,
          html: `
        <h3>New Message from BooksHouse Contact Form</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong><br/> ${message}</p>
      `,
        };

        // Send email
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: "Message sent successfully!" });
      } catch (error) {
        // console.error("Error sending email:", error);
        res.status(500).json({ error: "Failed to send message" });
      }
    });

    // Update Book with Authorization
    app.patch(
      "/update-book/:id",
      verifyToken,
      verifyTokenEmail,
      async (req, res) => {
        const data = req.body;
        if (data.email !== req.decoded.email) {
          return res.status(403).send({ message: "Forbidden: Email mismatch" });
        }
        const id = req.params.id;
        let filter = { _id: new ObjectId(id) };
        const doc = {
          $set: data,
        };
        const result = await bookCollections.updateOne(filter, doc);
        res.send(result);
      }
    );

    // Upvote Book
    app.patch("/upvote/:id", async (req, res) => {
      const { email } = req.body;
      const id = req.params.id;

      const filter = { _id: new ObjectId(id) };
      const book = await bookCollections.findOne(filter);

      if (book?.email === email) {
        return res.send({ message: "You cannot upvote your own book" });
      }

      const updateDoc = {
        $push: { upvote: email },
      };

      const result = await bookCollections.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Update Reading Status
    app.patch("/book/:id", async (req, res) => {
      const data = req.body;
      const id = req.params.id;
      const readingStatus = data.status;
      const filter = { _id: new ObjectId(id) };

      const doc = {
        $set: {
          reading_status: readingStatus,
        },
      };

      const result = await bookCollections.updateOne(filter, doc);
      res.send(result);
    });

    // Update Review
    app.patch("/update-review/:id", async (req, res) => {
      const review = req.body;
      const id = req.params.id;

      const newReview = review.comment;
      const filter = { _id: new ObjectId(id) };

      const doc = {
        $set: {
          comment: newReview,
        },
      };

      const result = await reviewCollections.updateOne(filter, doc);
      res.send(result);
    });

    // Delete Book with Authorization
    app.delete(
      "/books/:id",
      verifyToken,
      verifyTokenEmail,
      async (req, res) => {
        const id = req.params.id;
        let filter = { _id: new ObjectId(id) };

        const book = await bookCollections.findOne(filter);

        if (!book) {
          return res.status(401).send({ message: "Book not found" });
        }
        if (book.email !== req.decoded.email) {
          return res.status(403).send({
            message: "Forbidden: You are not authorized to delete this book.",
          });
        }

        const result = await bookCollections.deleteOne(filter);
        res.send(result);
      }
    );

    // Delete Review
    app.delete("/reviews/:id", async (req, res) => {
      const id = req.params.id;
      let filter = { _id: new ObjectId(id) };
      const result = await reviewCollections.deleteOne(filter);
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
