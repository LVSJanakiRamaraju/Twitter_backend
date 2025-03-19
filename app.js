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

//API: Login User
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const payLoad = {username}
  const jwtToken = jwt.sign(payLoad, 'SECRET_KEY')
  const userCheckQuery = `
    SELECT * FROM user WHERE username = '${username}';`
  const dbUser = await db.get(userCheckQuery)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatches = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatches) {
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})
const isUserFollowing = async (request, response, next) => {
  const {tweetId} = request.params
  const {username} = request.headers
  const getUserQuery = `
    SELECT * FROM user WHERE username = '${username}';`
  const dbUser = await db.get(getUserQuery)
  const userId = dbUser['user_id']
  const followingQuery = `SELECT following_user_id FROM follower WHERE follower_user_id = ${userId};`
  const userFollowingData = await db.all(followingQuery)
  // console.log(userFollowingData);

  const tweetUserIdQuery = `
    SELECT * FROM tweet WHERE tweet_id = ${tweetId}`
  const tweetData = await db.get(tweetUserIdQuery)
  const tweetUserID = tweetData['user_id']

  let isTweetUSerIDInFollowingIds = false
  userFollowingData.forEach(each => {
    if (each['following_user_id'] === tweetUserID) {
      isTweetUSerIDInFollowingIds = true
    }
  })

  if (isTweetUSerIDInFollowingIds) {
    next()
  } else {
    response.status(401)
    response.send('Invalid Request')
  }
}

//API - 3
app.get('/user/tweets/feed/', authenticateToken, async (request, response) => {
  const {username} = request.headers
  const getUserQuery = `
    SELECT * FROM user WHERE username = '${username}';`
  const dbUser = await db.get(getUserQuery)
  const userId = dbUser['user_id']

  const query = `
    SELECT username, tweet, date_time As dateTime
    FROM follower INNER JOIN tweet
    ON follower.following_user_id = tweet.user_id
    NATURAL JOIN user
    WHERE follower.follower_user_id = ${userId}
    ORDER BY dateTime DESC
    LIMIT 4`

  const data = await db.all(query)
  response.send(data)
})

module.exports = app
