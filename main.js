const express = require('express');
const helmet = require('helmet');
const rateLimit = require("express-rate-limit");
const http = require('http');
const path = require('path');
const app = express();
const port = 3005;
//const server = http.Server(app); // What is this even for?
//const request = require('request');
//const requestp = require('request-promise');
//const crypto = require('crypto'); // I understand that this library is bad?
//const ethjsutil = require('ethereumjs-util');
//const escape = require('escape-html'); // I've decided not to use this in the end, don't think script injection is a thing and this just messes up everything frontend-side
const help = require('./help.js');
const validatorWrapper = require('./validatorWrapper.js')();
const serviceLayer = require('./serviceLayer.js')();

async function genericReturnFalse(res) {
    res.send(JSON.stringify({
        success: false
    }));
}

async function start() {
    app.use(helmet());
    app.use(express.json({ limit: '100kb' })); // to support JSON-encoded bodies, limit is optional and 100kb is default, it limits how big a body can be, It is probably better to also implement via nginx
    app.use(express.urlencoded({ extended: true })); // to support URL-encoded bodies

    // Enable if you're behind a reverse proxy (Heroku, Bluemix, AWS ELB, Nginx, etc) - We probably will be in production, this is very important for the rate limiter, although an nginx rate limiter is definitely a better idea
    // see https://expressjs.com/en/guide/behind-proxies.html
    app.set('trust proxy', 1); // Remove if NOT behind a reverse proxy

    // A rate limiter is probably more prefferable in the nginx level, the rate limiting mechanism is a bit spaghetti, half of it here, half in the service layer
    app.use('/api/get/', rateLimit({
        windowMs: 60 * 1000, // 1 minutes
        max: 100 // limit each IP to 100 requests per windowMs
    }));
    app.use('/api/post/post/', rateLimit({
        windowMs: 20 * 1000, // 1 minutes (a lot less to avoid sync issues with the 1 post per minute per address service layer limitation)
        max: 1 // limit each IP to 1 
    }));
    app.use('/api/post/register/', rateLimit({
        windowMs: 60 * 1000, // 1 minutes, hard 1 minute, people shouldn't mess this up
        max: 1 // limit each IP to 1
    }));

    // Routes go here!
    // Get board meta, retrieves thread names etc
    app.route('/api/get/registrationStatus/').get(async (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        try {
            let registrationStatus = await serviceLayer.checkUserRegistrationProcess(req.headers.authorization);
            res.send(JSON.stringify({
                success: true, data: registrationStatus
            }));
        } catch (error) {
            help.log(error, req.ip, req.headers.authorization);
            genericReturnFalse(res);
        }
    });

    // Get board meta, retrieves thread names etc
    app.route('/api/get/boards/').get(async (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        try {
            let boardsToView = await serviceLayer.getUserBoards(req.headers.authorization);
            res.send(JSON.stringify({
                success: true, data: boardsToView
            }));
        } catch (error) {
            help.log(error, req.ip, req.headers.authorization);
            genericReturnFalse(res);
        }
    });

    // Get board meta, retrieves thread names etc
    app.route('/api/get/board/').get(async (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        try {
            let boardResult = await serviceLayer.getBoard(req.query.id, req.headers.authorization);
            res.send(JSON.stringify({
                success: true, data: boardResult
            }));
        } catch (error) {
            help.log(error, req.ip, req.headers.authorization);
            genericReturnFalse(res);
        }
    });

    // get thread, retrieves the posts of the thread, 1st post is always the OP
    app.route('/api/get/thread/').get(async (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        try {
            let threadResult = await serviceLayer.getThread(req.query.id, req.headers.authorization);

            res.send(JSON.stringify({
                success: true, data: threadResult
            }));
        } catch (error) {
            help.log(error, req.ip, req.headers.authorization);
            genericReturnFalse(res);
        }
    });

    // register
    app.route('/api/post/register/').post(async (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        try {
            if(validatorWrapper.validate(req.body, 'register')) {
                let registerResponse = await serviceLayer.registerUser({
                    address: req.body.address,
                    message: req.body.message,
                    messageSigned: req.body.messageSigned
                }, {
                    ip: req.ip
                });
                if (registerResponse) {
                    res.send(JSON.stringify({
                        success: true,
                        data: registerResponse
                    }));
                }
            }
            else {
                throw ({reason:'validator wrapped - invalid', obj:req.body});
            }
        } catch (error) {
            help.log(error, req.ip, req.headers.authorization);
            genericReturnFalse(res);
        }
    });

    // post
    app.route('/api/post/post/').post(async (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        try {
            if(validatorWrapper.validate(req.body, 'post')) {
                let savePostResponse = await serviceLayer.savePost(req.body.boardId, req.body.threadId, {
                    text: req.body.text,
                    author: req.headers.authorization
                }, {
                    ip: req.ip
                });
                if (savePostResponse) {
                    res.send(JSON.stringify({
                        success: true,
                        data: savePostResponse
                    }));
                }
            }
            else {
                throw ({reason:'validator wrapped - invalid', obj:req.body});
            }
        } catch (error) {
            help.log(error, req.ip, req.headers.authorization);
            genericReturnFalse(res);
        }
    });
    
    app.set('port', port);
    app.use('/', express.static(__dirname + '/static'));
    app.listen(port, () => help.log('Endpoint for tokentalk on port ' + port));
}

start();