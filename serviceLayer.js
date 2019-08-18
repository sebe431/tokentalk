function ServiceLayer() {
    const ethAdmins = require('./credsEthAdmins.json');
    const database = require('./dbInterface.js')();
    const ethereumHandler = new (require('./ethereumHandler.js'));
    const help = require('./help.js');
    const boards = new (require('./boards.js'));

    let boardsMeta = boards.getBoardsMeta();
    let usersWaitingValidations = [];

    let userExpiryTime = 1000*60*60*24*10; // 10 days

    help.setIntervalAsyncStartSkip(async (cb) => {
        if(usersWaitingValidations.length>0) {
            let userValidations = usersWaitingValidations.splice(0,1)[0];
            let returnAccess = {};
            
            try {
                returnAccess = await ethereumHandler.checkRequirementGetAccess(userValidations.userAddress, userValidations.validations)
            } catch (error) {
                help.log(error);
                usersWaitingValidations.push(userValidations);
            }

            try {
                // If user is admin, give him access to everything
                if(ethAdmins && ethAdmins[userValidations.userAddress] && ethAdmins[userValidations.userAddress] == true) {
                    Object.keys(returnAccess).forEach((key) => {
                        returnAccess[key] = true;
                    });
                }
            }
            catch (error) {
                help.log(error);
            }

            try {
                await database.updateUserAccess(userValidations.userAddress, returnAccess);
            } catch (error) {
                help.log(error);
            }
        }

        cb();
    },1000,60000);

    async function addUserValidationsToArr(userSecretKey) {
        let userAddress = (await database.getUser(userSecretKey)).address;
        let validations = [];

        Object.keys(boardsMeta).forEach(boardsMetaKey => {
            let boardReqs = boardsMeta[boardsMetaKey].reqs;
            boardReqs.forEach(req => {
                if(req.type != 'registration') {
                    validations.push({
                        req:req,
                        access: boardsMetaKey
                    });
                }
            });
        });

        usersWaitingValidations.push({
            userAddress: userAddress,
            validations: validations
        });
    }

    // Continuously delete threads over limit
    help.setIntervalAsyncStartSkip(async (cb) => {
        try {
            let boardsMetaKeys = Object.keys(boardsMeta);
            for(let i=0; i<boardsMetaKeys.length; i++) {
                let boardsMetaKey = boardsMetaKeys[i];
                let board = await database.getBoard(boardsMetaKey);

                if(board) {
                    let excessThreads = board.threadHeaders.length - boardsMeta[boardsMetaKey].maxThreads;
                    while(excessThreads>0) {
                        excessThreads--;
                        await deleteOldestThread(boardsMetaKey);
                    }
                }
                
            }
        } catch (error) {
            help.log(error);
        }
        
        cb();
    },15000,60000);

    async function deleteOldestThread(boardId) {
        let board = await database.getBoard(boardId);
        let oldestBumpedThread = null;
        let oldestBumpedTime = null;

        for(let i=0; i<board.threadHeaders.length; i++) {
            let thread = board.threadHeaders[i];
            if(!oldestBumpedThread || thread.bumpTime < oldestBumpedTime) {
                oldestBumpedThread = thread.threadId;
                oldestBumpedTime = thread.bumpTime;
            }
        }

        if(oldestBumpedThread) {
            help.log('deleting thread', oldestBumpedThread);
            await database.deleteThread(boardId, oldestBumpedThread);
        }
    }

    this.checkUserRegistrationProcess = async function (userSecretKey) {
        try {
            let user = await database.getUser(userSecretKey);
            return { registerTime: user.registerTime, lastPostTime: user.lastPostTime };
        } catch (error) {
            return null;
        }
    }

    async function checkIfUserCanReadBoard(board, user) {
        for (let i = 0; i < board.reqs.length; i++) {
            let req = board.reqs[i];

            // fail if requirement is registartion and there's no registration
            if (req.type == 'registration' && !user) {
                return false;
            }
            // or if no access to board
            else if (req.type != 'registration' && (!user || !user.access[board.id])) {
                return false;
            }
            // or if registration expired
            else if ((user.registerTime < new Date().getTime() - userExpiryTime)) {
                return false;
            }
        }

        return true;
    }

    this.getUserBoards = async function (userSecretKey) {
        let user = await database.getUser(userSecretKey);
        let simpleBoards = {};

        let boardsMetaKeys = Object.keys(boardsMeta);
        for(let i=0; i<boardsMetaKeys.length; i++) {
            let boardsMetaKey = boardsMetaKeys[i];

            if (await checkIfUserCanReadBoard(boardsMeta[boardsMetaKey], user)) {
                simpleBoards[boardsMetaKey] = boards.getSimpleBoardMeta(boardsMetaKey);
            }

        }

        return simpleBoards;
    }

    this.registerUser = async function (registrationData) {
        if (ethereumHandler.validateSignedMessage(registrationData.address, registrationData.message, registrationData.messageSigned)) {
            let userSecret = help.getRandomStr8() + '-' + new Date().getTime();
            await database.registerUser(
                {
                    address:registrationData.address.toLowerCase(),
                    currentUserSecretKey: userSecret,
                    registerTime: new Date().getTime(),
                    lastPostTime: 0,
                    access: {}
                });

            addUserValidationsToArr(userSecret);
            return { userSecretKey: userSecret };
        }
        else {
            throw { err: 'signedMessage invalid', registrationData: registrationData };
        }
    }

    this.getBoard = async function (boardId, userSecretKey) {
        let user = await database.getUser(userSecretKey);
        
        if (await checkIfUserCanReadBoard(boardsMeta[boardId], user) == false) {
            throw 'no access to board';
        }
        else {
            let board = await database.getBoard(boardId);

            if (board && board.threadHeaders) {
                for(let i=0; i<board.threadHeaders.length; i++) {
                    let element = board.threadHeaders[i];

                    // Anonamyze the author identity, the point is to have an address responsible privately while not disclosing them publicly
                    if(element.op.author.address && ethAdmins && ethAdmins[element.op.author.address]) {
                        element.op.author = 'Moderator';
                    }
                    else {
                        element.op.author = 'Anonymous';
                    }
                }
            }

            // Might be a bit repetative but this makes sure the element.op.author is a single string, preferably move this to a different system managed by main.js, I'm just questioning these ifs above
            for(let i=0; i<board.threadHeaders.length; i++) {
                if(typeof board.threadHeaders[i].op.author !== 'string') {
                    help.log('data not anonymized, failing get', boardId);
                    board = {};
                }
            }

            return board;
        }
    }

    this.getThread = async function (threadId, userSecretKey) {
        // We save threads unrelated to boards so we'll always have to query it 1st it seems
        let user = await database.getUser(userSecretKey);
        let thread = await database.getThread(threadId);
        
        if (await checkIfUserCanReadBoard(boardsMeta[thread.boardId], user) == false) {
            throw 'no access to board';
        }
        else {
            if (thread && thread.posts) {
                for(let i=0; i<thread.posts.length; i++) {
                    let element = thread.posts[i];

                    // Anonamyze the author identity, the point is to have an address responsible privately while not disclosing them publicly
                    if(element.author.address && ethAdmins && ethAdmins[element.author.address]) {
                        element.author = 'Moderator';
                    }
                    else {
                        element.author = 'Anonymous';
                    }
                }
            }

            // Might be a bit repetative but this makes sure the element.author is a single string
            for(let i=0; i<thread.posts.length; i++) {
                if(typeof thread.posts[i].author !== 'string') {
                    help.log('data not anonymized, failing get', threadId);
                    thread = {};
                }
            }

            return thread;
        }
    }

    this.savePost = async function (boardId, threadId, postData, userConnection) {
        let user = await database.getUser(postData.author);

        if (await checkIfUserCanReadBoard(boardsMeta[boardId], user) == false) {
            throw 'no access to board';
        }
        else if(postData.text.length > 2000) {
            throw 'text > 2000 characters';
        }
        else if(user && user.lastPostTime > (new Date().getTime() - (60*1000))) {
            throw 'user needs to wait a minute!';
        }
        else {
            postData.author = user ? user.address : null;
            postData.time = new Date().getTime();

            if (postData.author) {
                postData.author = { address: postData.author, ip: userConnection.ip };
            }
            else { // We should know that the user is posting on meta or another unregistered board prior to doing this
                postData.author = { address: null, ip: userConnection.ip };
            }

            // New thread
            if (!threadId) {
                threadId = help.getRandomStr8() + '-' + postData.time;
                return await database.makeThread(boardId, threadId, postData);
            }
            else {
                let thread = await database.getThread(threadId);
                return await database.makePost(boardId, threadId, postData, thread.posts.length < boardsMeta[boardId].maxPosts);
            }
        }
    }
}

let instance = null;
function getInstance() {
    instance = instance || new ServiceLayer();
    return instance;
}

if (typeof module !== 'undefined') {
    module.exports = getInstance
}