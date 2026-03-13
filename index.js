const dotenv = require('dotenv')
dotenv.config()

const app = require("./app")
const { connectToDatabase } = require("./utils/db")


const PORT = process.env.PORT || 4040

connectToDatabase()
    .then(() => {
        console.log('database connected successfully')
    })
    .catch((error) => {
        console.log('failed to connect to db', error)
    })

const server = app.listen(PORT, () => {
    console.log('server started successfully on port', PORT)
})

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.log(`server failed to start: port ${PORT} is already in use`)
        return;
    }
    console.log('server failed to start', error)
})