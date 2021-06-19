require('dotenv').config();
var app = require('express')();
var path = require('path');
const http = require('http').Server(app);
const io = require('socket.io')(http);
let CUSTOMER_SESSION = process.env.CUSTOMER_SESSION;
let TRADING212_SESSION_LIVE = process.env.TRADING212_SESSION_LIVE;

// viewed at http://localhost:8080
app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname + '/index.html'));
});

app.get('/client.js', function(req, res) {
    res.sendFile(path.join(__dirname + '/node_modules/socket.io-client/dist/socket.io.js'));
});

http.listen(3456, () => {
    console.log('listening on *:3456');
});

io.on('connection', (socket) => {
    console.log('a user connected');
    io.emit('account', wsAccount);
    io.emit('reaccount', wsAccountRe);
    io.emit('hotlist', hotlist);
    io.emit('forex', GBP_TO_USD);
    socket.on('deleteOrder', (orderId) => {
        trading212.deleteOrder(orderId);
    });
    socket.on('placeOrder', (order) => {
        console.log(order);
        trading212.placeOrder(order.code, order.orderType, order.stopPrice, order.limitPrice, order.quantity, order.timeValidity)
    });
    socket.on('modifyOrder', (order) => {
        console.log(order);
        trading212.modifyOrder(order.orderId, order.orderType, order.stopPrice, order.limitPrice, order.quantity, order.timeValidity)
    })
});

//Account/Stock data
var GBP_TO_USD = null;

var wsAccount = {};
var wsAccountRe = {};
var hotlist = {
    hourly: [],
    daily: [],
};
var subscribedSymbols = [];
var equityData = [];

var { trading212 } = require('trading212');
var trading212 = new trading212('live', CUSTOMER_SESSION, TRADING212_SESSION_LIVE);

trading212.on('connection-established', () => {
    trading212.getExchangeRate();
});

trading212.on('platform-subscribed', () => {
    console.log('wee event emitted');
    trading212.getAvailableEquities();
    refreshHotlist();
    setInterval(refreshHotlist, 20 * 1000);
})

function refreshHotlist() {
    trading212.getHotlist('hourly', 1);
    trading212.getHotlist('hourly', 4);
    trading212.getHotlist('hourly', 8);
    trading212.getHotlist('daily', 1);
    trading212.getHotlist('daily', 30);
}

trading212.on('equity-data', (data) => {
    equityData = data;
});

trading212.on('account', (data) => {
    if(data.hasOwnProperty("account")) {
        data = data.account;
    }
    wsAccount = data;
    var toSubscribe = [];
    for(var i = 0; i < data.positions.length; i++) {
        let position = data.positions[i];
         if(subscribedSymbols.indexOf(position.code) === -1 && toSubscribe.indexOf(position.code) === -1) {
             toSubscribe.push(position.code);
         }
    }
    for(var i = 0; i < data.equityOrders.length; i++) {
        let order = data.equityOrders[i];
         if(subscribedSymbols.indexOf(order.code) === -1 && toSubscribe.indexOf(order.code) === -1) {
             toSubscribe.push(order.code);
         }
    }
    if(toSubscribe.length) {
        trading212.bulkSubscribe(toSubscribe);
        subscribedSymbols.push(...toSubscribe);
    }

    io.emit('account', data);
})

trading212.on('reaccount', (data) => {
    console.log("emitted resp");
    wsAccountRe = data;
    var toSubscribe = [];
    for(var i = 0; i < data.open.items.length; i++) {
        let position = data.open.items[i];
         if(subscribedSymbols.indexOf(position.code) === -1 && toSubscribe.indexOf(position.code) === -1) {
             toSubscribe.push(position.code);
         }
    }
    for(var i = 0; i < data.orders.items.length; i++) {
        let order = data.orders.items[i];
         if(subscribedSymbols.indexOf(order.code) === -1 && toSubscribe.indexOf(order.code) === -1) {
             toSubscribe.push(order.code);
         }
    }
    if(toSubscribe.length) {
        trading212.bulkSubscribe(toSubscribe);
        subscribedSymbols.push(...toSubscribe);
    }
    
    io.emit('reaccount', wsAccountRe);
})

trading212.on('hotlist', (period, delta, data) => {
    hotlist[period][delta] = data;
    io.emit('hotlist', hotlist);
});

trading212.on('price', (data) => {
    for(var i = 0; i < equityData.length; i++) {
        var eq = equityData[i];
        if(eq.ticker == data.ticker) {
            eq = data;
            return;
        }
    }

    io.emit('price', data);
})

trading212.on('forex', (data) => {
    GBP_TO_USD = data.quoteSummary.result[0].price.regularMarketPrice.raw;
    io.emit('forex', GBP_TO_USD);
})