const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const cors = require('cors')

const dbPath = path.join(__dirname, 'financepeer.db')
const app = express()

app.use(express.json())
app.use(cors())

let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({filename: dbPath, driver: sqlite3.Database})
    app.listen(process.env.PORT || 3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(-1)
  }
}
initializeDBAndServer()

// Authentication token Middleware
const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers.authorization
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

// User SignUp Api
app.post('/signup/', async (request, response) => {
  const {username, password, gender, location} = request.body
  const hashedPassword = await bcrypt.hash(request.body.password, 10)
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`
  const dbUser = await db.get(selectUserQuery)
  if (dbUser === undefined) {
    const createUserQuery = `
      INSERT INTO
        user (username, password, gender, location)
      VALUES
        (
          '${username}',
          '${hashedPassword}',
          '${gender}',
          '${location}'
        )`
    await db.run(createUserQuery)
    response.status(200).json({res: 'user created'})
  } else {
    response.status(400).json({error: 'user already exists'})
  }
})

// User Login API
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`
  const dbUser = await db.get(selectUserQuery)
  if (dbUser === undefined) {
    response.status(400).json({error: 'invalid user'})
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatched === true) {
      const payload = {
        username,
      }
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400).json({error: 'invalid password'})
    }
  }
})

app.get('/blog/', authenticateToken, async (request, response) => {
  const getStatesQuery = `
    SELECT
      *
    FROM
      blog;`
  const statesArray = await db.all(getStatesQuery)
  response.send(statesArray)
})

app.post('/saveblogs/', async (request, response) => {
  const blogsData = request.body
  const values = []
  const blogDataString = blogsData
    .map(
      each => `(${each.id}, '${each.title}', '${each.body}', ${each.userId})`,
    )
    .join(', ')
  const saveBlogQuery = `INSERT INTO blog(id, title, body, userid) values ${blogDataString}`
  await db.run(saveBlogQuery)
  response.send('Blogs Data added successfully')
})

module.exports = app
