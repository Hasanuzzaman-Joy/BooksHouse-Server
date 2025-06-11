require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const admin = require("firebase-admin");
const express = require('express');
const app = express();
const port = process.env.PORT || 5000;
const cors = require('cors')

// Middlewares
app.use(cors());
app.use(express.json());

const verifyToken = async (req, res, next) => {
  const authHeaders = req.headers.authorization;
  if (!authHeaders || !authHeaders.startsWith('Bearer ')) {
    return res.status(401).send({ message: 'Access denied: Invalid token provided.' })
  }

  const token = authHeaders.split(' ')[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.decoded = decoded;
  }
  catch (error) {
    return res.status(401).send({ message: 'Access denied: Failed to verify token.' });
  }
  next();
}

const verifyTokenEmail = async (req, res, next) => {
  if (req.query.email) {
    if (req.query.email !== req.decoded.email) {
      res.status(403).send({ message: 'Access forbidden: Email does not match authenticated user.' })
    }
  }
  next()
}

// Firebase
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf-8');
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// MongoDB
const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

    const bookCollections = client.db('booksDB').collection('books');
    const reviewCollections = client.db('booksDB').collection('reviews');

    app.get('/all-books', async (req, res) => {
      const filteredStatus = req.query.filteredStatus;
      const searchParams = req.query.searchParams;

      const filter = {};

      if (filteredStatus) {
        filter.reading_status = filteredStatus;
      }

      if (searchParams) {
        filter.$or = [
          { book_title: { $regex: searchParams, $options: 'i' } },
          { book_author: { $regex: searchParams, $options: 'i' } }
        ];
      }

      const result = await bookCollections.find(filter).toArray();
      res.send(result);
    })

    app.get('/books', verifyToken, verifyTokenEmail, async (req, res) => {
      const email = req.query.email;
      let query = { email: email };
      const result = await bookCollections.find(query).toArray();
      res.send(result);
    })

    app.get('/book/:id', async (req, res) => {
      const id = req.params.id;
      let filter = { _id: new ObjectId(id) };
      const result = await bookCollections.findOne(filter);
      res.send(result);
    })
    
    app.get('/popular-books', async (req, res) => {
      const allBooks = await bookCollections.find().toArray();
      allBooks.sort((a, b) => (b.upvote?.length || 0) - (a.upvote?.length || 0));
      const result = allBooks.slice(0, 6);
      res.send(result);
    });

    app.get('/all-reviews/:id', async (req, res) => {
      const id = req.params.id;
      let filter = { reviewedBookId: id };
      const result = await reviewCollections.find(filter).toArray();
      res.send(result)
    })

    app.post('/add-book', async (req, res) => {
      const data = req.body;
      data.total_page = parseInt(data.total_page);
      const result = await bookCollections.insertOne(data);
      res.send(result);
    })

    app.post('/reviews', async (req, res) => {
      const review = req.body;
      const email = review.reviewerEmail;
      const commentedBook = review.reviewedBookId;

      const existingReview = await reviewCollections.findOne({
        reviewerEmail: email,
        reviewedBookId: commentedBook
      });

      if (existingReview) {
        return res.send({ message: "You have already added a review for this book" });
      }

      const result = await reviewCollections.insertOne(review);
      res.send(result);
    });


    app.patch('/update-book/:id', async (req, res) => {
      const data = req.body;
      const id = req.params.id;
      let filter = { _id: new ObjectId(id) };
      const doc = {
        $set: data
      }
      const result = await bookCollections.updateOne(filter, doc);
      res.send(result);
    })

    app.patch('/upvote/:id', async (req, res) => {
      const { email } = req.body;
      const id = req.params.id;

      const filter = { _id: new ObjectId(id) };
      const book = await bookCollections.findOne(filter);

      if (book?.email === email) {
        return res.send({ message: 'You cannot upvote your own book' });
      }

      const updateDoc = {
        $push: { upvote: email }
      };

      const result = await bookCollections.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.patch('/book/:id', async (req, res) => {
      const data = req.body;
      const id = req.params.id; //data.id
      const readingStatus = data.status;
      const filter = { _id: new ObjectId(id) };

      const doc = {
        $set: {
          reading_status: readingStatus
        }
      }

      const result = await bookCollections.updateOne(filter, doc);
      res.send(result);
    })

    app.patch('/update-review/:id', async (req, res) => {
      const review = req.body;
      const id = req.params.id;

      const newReview = review.comment;
      const filter = { _id: new ObjectId(id) };

      const doc = {
        $set: {
          comment: newReview
        }
      }

      const result = await reviewCollections.updateOne(filter, doc);
      res.send(result);
    })

    app.delete('/books/:id', async (req, res) => {
      const id = req.params.id;
      let filter = { _id: new ObjectId(id) };
      const result = await bookCollections.deleteOne(filter);
      res.send(result);
    })

    app.delete('/reviews/:id', async (req, res) => {
      const id = req.params.id;
      let filter = { _id: new ObjectId(id) };
      const result = await reviewCollections.deleteOne(filter);
      res.send(result);
    })
  }

  finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})