'use strict'

var util = require('util')
var net = require('net')
var http = require('http')
var once = require('once')
var consume = require('consume-http-header')

module.exports = ReverseServer

util.inherits(ReverseServer, http.Server)

function ReverseServer (opts, onRequest) {
  if (!(this instanceof ReverseServer)) return new ReverseServer(opts, onRequest)

  http.Server.call(this)

  this.setTimeout(0)

  if (!opts) opts = {}
  if (!opts.method) opts.method = 'POST'
  if (!opts.headers) opts.headers = {}
  if (!opts.headers['Upgrade']) opts.headers['Upgrade'] = 'PTTH/1.0'
  if (!opts.headers['Connection']) opts.headers['Connection'] = 'Upgrade'
  if (onRequest) this.on('request', onRequest)

  var server = this
  var closed = false

  this.on('close', function () {
    closed = true
  })

  connect()

  function connect () {
    if (closed) return

    var onClose = once(connect)
    var socket = net.connect(opts)

    socket.on('connect', upgrade)
    socket.on('error', onError)

    function upgrade () {
      socket.on('close', onClose)
      socket.on('end', onClose)

      consume(socket, function (err, head) {
        if (err) {
          server.emit('error', err)
          socket.destroy()
        } else if (head.statusCode === 101 &&
            head.headers.upgrade === 'PTTH/1.0' &&
            head.headers.connection === 'Upgrade') {
          server.emit('connection', socket)
        } else {
          server.emit('error', new Error('Unexpected response to PTTH/1.0 Upgrade request'))
          socket.destroy()
        }
      })

      socket.write('POST / HTTP/1.1\r\n' +
                   'Upgrade: PTTH/1.0\r\n' +
                   'Connection: Upgrade\r\n' +
                   'Content-Length: 0\r\n\r\n')
    }
  }

  function onError (err) {
    server.emit('error', err)
  }
}
