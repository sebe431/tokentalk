function DatabaseInterface() {
    const creds = require('./credsDB.json');
    const help = require('./help.js');
    const mongoose = require('mongoose');
    mongoose.connect(creds.uri, { useNewUrlParser: true, user: creds.user, pass: creds.pass });

    const db = mongoose.connection;
    db.on('error', console.error.bind(console, 'connection error:'));
    db.once('open', function () {
        // we're connected!
        help.log('mongodb & mongoose work');
    });

    let userSchema = new mongoose.Schema({
        currentUserSecretKey: String,
        address: String,
        registerTime: Number,
        lastPostTime: Number,
        access: Object,
    });

    var threadHeaderSchema = new mongoose.Schema({
        threadId: String,
        op: Object,
        bumpTime: Number,
        postCount: Number
    });

    var boardSchema = new mongoose.Schema({
        boardId: String,
        threadHeaders: [threadHeaderSchema]
    });

    var postSchema = new mongoose.Schema({
        author: Object,
        time: Number,
        text: String
    });

    var threadSchema = new mongoose.Schema({
        threadId: String,
        boardId: String,
        posts: [postSchema]
    });

    let User = mongoose.model('User', userSchema);
    let Board = mongoose.model('Board', boardSchema);
    let Thread = mongoose.model('Thread', threadSchema);

/* 
    // A brief testing thing to make sure everything works
    setTimeout(async () => {
        return;
        await this.registerUser({
            currentUserSecretKey: 'yoyo',
            address: '0x0',
            registerTime: 0,
            lastPostTime: 0,
            access: { 'meta': true }
        });
        console.log(await this.getUser('yoyo'));
        console.log(await this.getUser('noExist'));

        await this.deleteThread('meta','randomid');
        await this.makeThread('meta', 'randomid', {
            threadId: 'randomid',
            text: 'sample text',
            time: new Date().getTime(),
            author: { address: '0x0', ip: '1.1.1.1' }
        });
        console.log(await this.getBoard('meta'));
        console.log(await this.getThread('randomid'));
    }, 3000); 
*/

    async function getDocumentFull(model, condition) {
        try {
            let doc = await model.findOne(condition).exec();
            return doc;
        } catch (error) {
            return null;
        }
    }

    // the only difference fropm above is .lean(), returns a plain object without persistance capabilities
    async function getDocument(model, condition) {
        try {
            let doc = await model.findOne(condition).lean().exec();
            return doc;
        } catch (error) {
            return null;
        }
    }

    this.registerUser = async function (userData) {
        await User.updateOne({ address: userData.address }, userData, { upsert: true });
    }

    this.updateUserAccess = async function (userAddress, access) {
        let user = await getDocumentFull(User, { address: userAddress });
        user.access = access;
        await user.save();
    }

    this.getUser = async function (userSecret) {
        return await getDocument(User, { currentUserSecretKey: userSecret });
    }

    this.getBoard = async function (boardId) {
        return await getDocument(Board, { boardId: boardId });
    }

    this.getThread = async function (threadId) {
        return await getDocument(Thread, { threadId: threadId });
    }

    this.deleteThread = async function (boardId, deleteThreadId) {
        let board = await getDocumentFull(Board, { boardId: boardId });

        for (let i = 0; i < board.threadHeaders.length; i++) {
            let threadHeaderTemp = board.threadHeaders[i];

            if (threadHeaderTemp.threadId == deleteThreadId) {
                threadHeaderTemp.remove();
                break;
            }
        }

        await board.save();
        await Thread.deleteOne({ threadId: deleteThreadId });
    }

    this.makeThread = async function (boardId, threadId, postData) {
        let board = await getDocumentFull(Board, { boardId: boardId });

        if (!board) {
            board = new Board({ boardId: boardId, threadHeaders: [] });
            await board.save();
        }

        board.threadHeaders.push({
            threadId: threadId,
            op: postData,
            bumpTime: postData.time,
            postCount: 1
        });

        let thread = new Thread({
            threadId: threadId,
            boardId: boardId,
            posts: [postData]
        });

        await thread.save();
        await board.save();

        // Updates the user's last post time
        if (postData.author.address) {
            let user = await getDocumentFull(User, { address: postData.author.address });
            user.lastPostTime = postData.time;
            await user.save();
        }

        return { boardId: boardId, threadId: threadId };
    }

    this.makePost = async function (boardId, threadId, postData, doBump) {
        let board = await getDocumentFull(Board, { boardId: boardId });
        let thread = await getDocumentFull(Thread, { threadId: threadId });
        let threadHeader = null;

        for (let i = 0; i < board.threadHeaders.length; i++) {
            let threadHeaderTemp = board.threadHeaders[i];

            if (threadHeaderTemp.threadId == threadId) {
                threadHeader = threadHeaderTemp;
                break;
            }
        }

        if (doBump) {
            threadHeader.bumpTime = postData.time;
        }

        threadHeader.postCount = threadHeader.postCount + 1;
        thread.posts.push(postData);

        await thread.save();
        await board.save();

        // Updates the user's last post time
        if (postData.author.address) {
            let user = await getDocumentFull(User, { address: postData.author.address });
            user.lastPostTime = postData.time;
            await user.save();
        }

        return { boardId: boardId, threadId: threadId };
    }
}

let instance = null;
function getInstance() {
    instance = instance || new DatabaseInterface();
    return instance;
}

if (typeof module !== 'undefined') {
    module.exports = getInstance
}