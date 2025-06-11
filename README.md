# 📚 BooksHouse - Book Review & Management API
**BooksHouse** is a backend REST API built with **Node.js**, **Express.js**, and **MongoDB**, designed to power a book review web application. Users can browse books, leave reviews, and manage personal reading preferences.

## 🌐 Live Site
👉 [Visit BooksHouse Live](https://bookshouse-b97b1.web.app/)

> This API is used by the BooksHouse frontend to fetch books, submit reviews, and perform all CRUD operations in real time. It ensures smooth communication between the user interface and the MongoDB database, offering a seamless book browsing and reviewing experience.

---

## ⚙️ Technologies Used
- Node.js
- Express.js
- MongoDB (Atlas)
- Mongoose
- dotenv
- CORS

---

## 🚀 Features
- Add, update, or delete books
- Leave reviews on books (with rating and comments)
- View, update, or delete individual reviews
- Fetch books by category or search query
- Filter recent books
- Secure routes with token based authentication

---

## 📂 API Endpoints

### 📚 Get All Books
```http
GET /books
```

---

### 🔍 Get Recent Books
```http
GET /books/recent
```

---

### ✏️ Add a New Book
```http
POST /books
```

---

### 🕓 Update Book
```http
PATCH /books/:id
```

---

### ❌ Delete Book
```http
DELETE /books/:id
```

---

### ➕ Add a Review
```http
POST /reviews
```

---

###  Get All Reviews for a Book
```http
GET /reviews/:bookId
```

---

### ✏️ Update Review
```http
PATCH /reviews/:id
```

---

### ❌ Delete Review
```http
DELETE /reviews/:id
```

---

**© 2025 BooksHouse | All Rights Reserved**

---

### Made with ❤️ by Hasanuzzaman Joy
