// Set default node environment to development
process.env.NODE_ENV = process.env.NODE_ENV || 'development'

var express = require('express')
var serveStatic = require('serve-static')
var bodyParser = require('body-parser')
var nunjucks = require('nunjucks')
var rubles = require('rubles').rubles
var numeral = require('numeral')
var redis = require('redis')
var client = redis.createClient()

var dateFormat = require('dateformat')
var fs = require('fs')
var pdf = require('html-pdf')

var config = require('./config/config.json')

var app = express()
var server = require('http').createServer(app)

var env = nunjucks.configure({
  autoescape: true
})

env.addFilter('countSum', function (services) {
  var totalSum = 0
  for (var i = 0; i < services.length; i++) {
    totalSum = totalSum + (services[i].amount * services[i].price)
  }
  return totalSum
})

env.addFilter('rubles', function (amount) {
  return rubles(amount)
})

env.addFilter('formatMoney', function (number) {
  return numeral(number).format('0,0[.]00')
})

app.use(serveStatic('public', {'index': ['index.html']}))
app.use(bodyParser.urlencoded({ extended: true }))

app.get('/config', function (req, res) {
  res.send({
    dadata: config.dadata
  })
})

app.post('/request', function (req, httpRes) {
  var curDate = dateFormat(new Date(), 'dd.mm.yyyy')
  var redisDate = dateFormat(new Date(), 'dmyy')
  client.incr('gc:bill-number:' + redisDate, function (err, bill_number) {
    if (err) {
      console.error(err)
    }
    var billNumber = redisDate + '-' + bill_number
    var billname = 'bill-' + billNumber + '.pdf'
    var html = fs.readFileSync('./public/data/bill.html', 'utf8')
    var options = {
      filename: './public/data/bills/' + billname,
      format: 'A4'
    }
    var pdfTemplate = env.renderString(html, {data: req.body, curDate: curDate, billNumber: '' + billNumber, config: config})
    pdf.create(pdfTemplate, options).toFile(function (err, res) {
      if (err) return console.log(err)
      httpRes.set('Content-Disposition', ['attachment; filename=', billname, '.pdf'].join(''))
      httpRes.type('pdf')
      httpRes.sendFile(res.filename)
    })
  })
})

var nodeConfig = {
  ip: process.env.IP || undefined,
  port: process.env.PORT || 8080
}

// Start server
server.listen(nodeConfig.port, nodeConfig.ip, function () {
  console.log('Express server listening on %d, in %s mode', nodeConfig.port, app.get('env'))
})

// Expose app
exports = module.exports = app
