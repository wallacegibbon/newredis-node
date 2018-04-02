const net = require("net")


const server = net.createServer(c => {
  console.log("client connected")

  c.on("end", () => {
    console.log("client disconnected(end)")
  })

  c.write("hello\r\n")
})


server.on("error", e => {
  console.error("**Server Error:", e)
})


server.listen(6379, () => {
  console.log("Server listening on 6379...")
})

