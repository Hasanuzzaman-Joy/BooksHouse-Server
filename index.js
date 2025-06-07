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
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const bookCollections = client.db('booksDB').collection('books');


    app.get('/books', verifyToken, verifyTokenEmail, async (req, res) => {
      const email = req.query.email;

      let query = {};
      if (email) {
        query = { email: email }
      }

      const result = await bookCollections.find(query).toArray();
      res.send(result);
    })

    app.get('/book/:id', async (req, res) => {
      const id = req.params.id;
      let filter = { _id: new ObjectId(id) };
      const result = await bookCollections.findOne(filter);
      res.send(result);
    })

    app.post('/add-book', async (req, res) => {
      const data = req.body;
      data.total_page = parseInt(data.total_page);
      const result = await bookCollections.insertOne(data);
      res.send(result);
    })

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

    app.delete('/books/:id', async (req, res) => {
      const id = req.params.id;
      let filter = { _id: new ObjectId(id) };
      const result = await bookCollections.deleteOne(filter);
      res.send(result);
    })



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
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