const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()
app.use(express.json())

dbPath = path.join(__dirname, 'twitterClone.db')
let db = null

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log(`Server Running at http://localhost:3000/`)
    })
  } catch (error) {
    console.log(`DB Error: ${error.message}`)
    process.exit(1)
  }
}
initializeDbAndServer()

//API: Register New User
app.post('/register/', async (request, response) => {
  const {username, password, name, gender} = request.body

  const userCheckQuery = `
    SELECT * FROM user WHERE username = '${username}';`
  const dbUser = await db.get(userCheckQuery)
  if (dbUser === undefined) {
    if (password.length < 6) {
      response.status(400)
      response.send('Password is too short')
    } else {
      const hashPassword = await bcrypt.hash(password, 10)
      const registerUserQuery = `
            INSERT INTO 
                user(username, password, name, gender)
            VALUES
                ('${username}', '${hashPassword}', '${name}', '${gender}');`
      await db.run(registerUserQuery)
      response.send('User created successfully')
    }
  } else {
    response.status(400)
    response.send('User already exists')
  }
})
const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'SECRET_KEY', async (error, payLoad) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.headers.username = payLoad.username
        next()
      }
    })
  }
}





module.exports = app
