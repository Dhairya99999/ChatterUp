//importing all libraries
import express from 'express';
import { connectUsingMongoose } from './src/config/db.config.js';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import { userModel } from './src/schema/users.schema.js';
import { chatModel } from './src/schema/chat.schema.js';


const app = express();

//using cors to give access to clients
app.use(cors());
app.use(express.static('public'));

//making a server
const server = http.createServer(app);

const io = new Server(server, {
    cors:
    {
        origin:'*',
        methods:['GET','POST']
    }
});

io.on('connection', (socket) => {

    console.log('Connection is established')

    // Handle user starts typing event
    socket.on('typing', () => {
        socket.broadcast.emit('user_typing', socket.username);
    });

    // Handle user stops typing event
    socket.on('stop_typing', () => {
        socket.broadcast.emit('user_stop_typing', socket.username);
    });

    // Handle incoming messages from clients
    socket.on('send_message', (message) => {
        // Broadcast the message to all connected users
        io.emit('receive_message', { username: socket.username, message: message });

        // Save the message to the database
        const newMessage = new chatModel({ username: socket.username, message: message });
        newMessage.save()
            .then(savedMessage => {
                console.log('Message saved:', savedMessage);
            })
            .catch(err => {
                console.error('Error saving message:', err);
            });
    });


    socket.on('disconnect', () => {
        console.log('Connection is disconnected')
        console.log(socket.username)
        // return
        // socket.broadcast.emit('user_disconnected', username)

        if (socket.username) {
            userModel.findOneAndDelete({ name: socket.username })
                .then(deletedUser => {
                    if (deletedUser) {
                        userModel.find()
                            .then(users => {
                                io.emit('load_users', users);
                            })
                            .catch(err => {
                                console.error('Error fetching users:', err);
                            });
                    }
                })
                .catch(err => {
                    console.error('Error deleting user:', err);
                });
        }

        // userModel.findOneAndDelete({name: socket.username})
        //     .then(user => {
        //         userModel.find()
        //         .then(users => {
        //             socket.emit('load_users', users)
        //         }).catch(err => {
        //             console.log(err)
        //         })
        //     })
        //     .catch(err => {
        //         console.log(err)
        //     })

    })

    // new user joined
    socket.on('new_user_joined', (name) => {

        // Load previous messages from the database
        chatModel.find().sort({ createdAt: 'asc' })
        .then( messages => {
            // Send previous messages to the client
            socket.emit('load_messages', messages);
        })
        .catch(err => {
            console.error('Error fetching messages:', err);
        })

      

        // broadcast user
        console.log(name)
        socket.username = name;
        const newUser = new userModel({ name });
        newUser.save()
            .then(savedUser => {
                userModel.find()
                    .then(users => {
                        io.emit('load_users', users);
                    })
                    .catch(err => {
                        console.error('Error fetching users:', err);
                    });
            })
            .catch(err => {
                console.error('Error saving user:', err);
            });

        // load old messag
    })
})
//starting the server and connecting to db
server.listen(3000,()=>{
    console.log("Connected to Server");
    connectUsingMongoose();
})