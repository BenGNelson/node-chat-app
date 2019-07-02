const path = require('path')
const http = require('http')
const express = require('express')
const socketio = require('socket.io')
const { generateMessage, generateLocationMessage } = require('./utils/messages')
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users')

const app = express()
const server = http.createServer(app)
const io = socketio(server)

const port = process.env.PORT || 3000
const publicDirectoryPath = path.join(__dirname, '../public')

// Name of user sending server messages
const systemMessenger = 'Server'

app.use(express.static(publicDirectoryPath))

// On a new connection
io.on('connection', (socket) => {
    console.log('New WebSocket connection')

    // A new client joins
    socket.on('join', (options, callback) => {
        const { error, user } = addUser({ id: socket.id, ...options })

        // User could not be added
        if (error) {
            return callback(error)
        }

        socket.join(user.room)

        // Send welcome and new user joined messages
        socket.emit('message', generateMessage(systemMessenger, 'Welcome!'))
        socket.broadcast.to(user.room).emit('message', generateMessage(systemMessenger, `${user.username} has joined!`))
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })

        callback()
    })

    // A user sends a message
    socket.on('sendMessage', (message, callback) => {
        const user = getUser(socket.id)

        io.to(user.room).emit('message', generateMessage(user.username, message))
        callback()
    })

    // A user shares his or her location
    socket.on('sendLocation', (position, callback) => {
        const user = getUser(socket.id)

        io.emit('locationMessage', generateLocationMessage(user.username, `https://google.com/maps?q=${position.latitude},${position.longitude}`))
        callback()
    })

    // A user disconnects
    socket.on('disconnect', () => {
        const user = removeUser(socket.id)

        if (user) {
            io.to(user.room).emit('message', generateMessage(systemMessenger, `${user.username} has left!`))
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
    })
})

server.listen(port, () => {
    console.log(`Server is up on port ${port}`)
})