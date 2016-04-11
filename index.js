'use strict'

var util = require('util')
var http = require('http')
var once = require('once')

module.exports = ReverseServer

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
    var req = http.request(opts)

    req.on('error', function (err) {
      server.emit('error', err)
    })

    req.on('upgrade', function (res, socket, head) {
      socket.on('close', onClose)
      socket.on('end', onClose)
      server.emit('connection', socket)
      if (head.length) socket.push(head)
    })

    req.end()
  }
}

util.inherits(ReverseServer, http.Server)
