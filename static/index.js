// Return only HH:MM if it's within the last 24 hours, full date otherwise
Date.prototype.toStringReadable = function () {
    if (this.getTime() > new Date().getTime() - 1000 * 60 * 60 * 24) {
        return (this.getHours() > 9 ? this.getHours() : ('0' + this.getHours())) +
            ":" + (this.getMinutes() > 9 ? this.getMinutes() : ('0' + this.getMinutes()));
    }

    return this.getFullYear() +
        "/" + ((this.getMonth() + 1) > 9 ? (this.getMonth() + 1) : ('0' + (this.getMonth() + 1))) +
        "/" + (this.getDate() > 9 ? this.getDate() : ('0' + this.getDate())) +
        " " + (this.getHours() > 9 ? this.getHours() : ('0' + this.getHours())) +
        ":" + (this.getMinutes() > 9 ? this.getMinutes() : ('0' + this.getMinutes()));
}

function generalError(error) {
    console.log(error);
}

// vue event bus, transferring things between child/parent components was delegated to another library and I don't intend to use it
const bus = new Vue();

// Vue components, they gotta load before new Vue()
Vue.component('post-box', {
    data: function () {
        return {
            postText: '',
            postTextExtra: '',
            postCounterInterval: null
        }
    },
    props: ['button-text', 'custom-placeholder'],
    methods: {
        postMessageEventTrigger: function (text) {
            bus.$emit('post-message', text);
        },
        clearTextarea: function () {
            let vm = this;
            vm.postText = '';
        },
        newPostLimit: function (newTime) {
            let vm = this;
            if(vm.postCounterInterval) {
                clearInterval(vm.postCounterInterval);
                vm.postCounterInterval = null;
            }

            vm.postCounterInterval = setInterval(function () {
                if(new Date().getTime() > newTime) {
                    vm.postTextExtra = '';
                    clearInterval(vm.postCounterInterval);
                }
                else {
                    vm.postTextExtra = ((newTime - (new Date().getTime()))/1000).toFixed(0);
                }
            }, 100);
        }
    },
    template: `
        <div class="padded" v-on:clear-textareas="clearTextarea">
            <textarea rows="5" class="full-width" v-bind:placeholder="customPlaceholder" v-model="postText"></textarea>
            <button @click.exact.prevent="postMessageEventTrigger(postText)" class="">{{buttonText + (postTextExtra ? '(' + postTextExtra + ')' : '')}}</button> <span style="color:red;" v-if="postText.length >= 2000">text too long (over 2000 characters)</span>
        </div>
    `,
    mounted: function () {
        bus.$on('clear-textareas', this.clearTextarea);
        bus.$on('new-post-limit', this.newPostLimit);
        bus.$emit('new-post-limit', getNextLocalPostTime());
    }
});

// Vue app
let app = new Vue({
    el: '#app',
    data: {
        // popup modal
        showPopupModal: null,
        popupModalData: { preset: 0, title: 'Title', text: 'text' },

        // Reloaded via URL parameters / actions
        currentBoard: null,
        currentThread: null,

        // User data, register, last post, etc
        userData: { status: 'unregistered', registerTime: null, lastPostTime: 0 },

        // Reloaded in update();
        boards: [],
        threads: [],
        posts: [],
    },
    methods: {
        goHome: function () {
            this.currentBoard = null;
            this.currentThread = null;
            updateState();
            refreshUI();
        },
        goBoard: function (id) {
            this.currentBoard = id;
            this.currentThread = null;
            updateState();
            refreshUI();
        },
        goThread: function (id) {
            this.currentThread = id;
            updateState();
            refreshUI();
        },
        register: async () => {
            if (typeof window.ethereum !== 'undefined'
                || (typeof window.web3 !== 'undefined')) {
                await ethereum.enable();

                setTimeout(() => {
                    if (web3 && web3.eth && web3.eth.defaultAccount) {
                        let messageToSign = '{"message":"registration","currentTime":' + new Date().getTime() + '}';
                        let msg = web3.fromUtf8(messageToSign); // makes string into hex
                        let from = web3.eth.defaultAccount;

                        web3.personal.sign(msg, from, function (err, result) {
                            if (err) {
                                throw err;
                            }

                            fetch('api/post/register/', {
                                method: 'POST',
                                body: JSON.stringify({
                                    address: from,
                                    message: messageToSign,
                                    messageSigned: result
                                }),
                                headers: {
                                    'Accept': 'application/json',
                                    'Content-Type': 'application/json',
                                    'authorization': getUserSecretKey()
                                }
                            }).then(async res => {
                                response = await res.json();
                                console.log(response);

                                if (response.status == 429) {
                                    alert('too many requests, 1 registration per minute, are you trying to be cheeky?');
                                }
                                else {
                                    if (response && response.data && response.data.userSecretKey) {
                                        updateUserSecretKey(response.data.userSecretKey);
                                    }

                                    displayCustomPopup('Congrats!', 'You have registered. You are still anonymous to users. Please refresh the homepage in a few seconds, we should have gathered what boards you can access by then.');
                                }
                            }).catch(generalError).finally(() => {
                                refreshUser();
                                refreshUI();
                            });
                        });
                    }
                }, 1000);
            }
            else {
                displayCustomPopup('No metamask?', 'It appears you do not have the metamask extension installed, at this time we do not support other methods of registration.');
            }

        },
        postMessage: function (text) {
            let vm = this;

            // Check that we can post, if
            if(getNextLocalPostTime() && getNextLocalPostTime() > new Date().getTime()) {
                return;
            }

            fetch('api/post/post/', {
                method: 'POST',
                body: JSON.stringify({
                    boardId: vm.currentBoard,
                    threadId: vm.currentThread,
                    text: text
                }),
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'authorization': getUserSecretKey()
                }
            }).then(async res => {
                response = await res.json();
                console.log(response);

                if(response.success) {
                    if(response.data.threadId) {
                        vm.goThread(response.data.threadId);
                    }

                    let newPostTime = (new Date().getTime() + 60*1000);

                    bus.$emit('clear-textareas');
                    bus.$emit('new-post-limit', newPostTime);
                    updateNextLocalPostTime(newPostTime);
                }
            }).catch(generalError).finally(() => {
                //refreshUI(); // Technically the goThread() calls this already
            });
        },
        openRegistrationHelp: function () {
            this.popupModalData.preset = 1;
            this.showPopupModal = true;
        },
    },
    mounted: function() {
        bus.$on('post-message', this.postMessage);
    }
});

function displayCustomPopup(title, text) {
    app.showPopupModal = true;
    app.popupModalData.preset = 0;
    app.popupModalData.title = title;
    app.popupModalData.text = text;
}

// This handles the user pressing backwards/forwards/etc
// There's probably a more vue-centric way of handling this but figuring out vue-router for this tiny feature is too much work
window.addEventListener('popstate', function (e) {
    if (e && e.target && e.target.location && e.target.location.href) {
        let url = new URL(e.target.location.href);
        app.currentBoard = url.searchParams.get("board");
        app.currentThread = url.searchParams.get("thread");
        refreshUI();
    }
});

// This key is used when sending get requests to the server to identify the sender, and is generated after registering
// It's supposed to expire after 10 days, and doesn't include any sensitive information
// Really its main purpose is to give you hidden board get access without requiring you to sign a message every time
// as a side purpose it could be considered as somewhat of a 2FA to posting, as simply sending posts with signed messages won't be enough to actually post
// The only real risk here is that if a user gets his secret key stolen, the attacker can read what people wrote on the hidden boards the secret key opens
function getUserSecretKey() {
    return localStorage.getItem('userSecretKey');
}

function updateUserSecretKey(newUserSecretKey) {
    localStorage.setItem('userSecretKey', newUserSecretKey);
}

// Handles UI for posting cooldowns for unregistered & refreshing users
function getNextLocalPostTime() {
    return localStorage.getItem('nextLocalPostTime');
}

function updateNextLocalPostTime(newLocalPostTime) {
    localStorage.setItem('nextLocalPostTime', newLocalPostTime);
}

function updateState() {
    if (app.currentBoard && app.currentThread) {
        window.history.pushState({}, document.title, "?board=" + app.currentBoard + '&thread=' + app.currentThread);
    }
    else if (app.currentBoard && !app.currentThread) {
        window.history.pushState({}, document.title, "?board=" + app.currentBoard);
    }
    else if (!app.currentBoard && !app.currentThread) {
        window.history.pushState({}, document.title, "?");
    }
}

function refreshUI() {
    // Clear data from current views
    app.boards = [];
    app.threads = [];
    app.posts = [];

    if (!app.currentBoard && !app.currentThread) {
        fetch('api/get/boards/', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'authorization': getUserSecretKey()
            }
        }).then(async res => {
            response = await res.json();
            console.log(response);

            app.boards = [];
            Object.keys(response.data).forEach(element => {
                app.boards.push(response.data[element]);
            });
        })
            .catch(generalError);
    }
    else if (app.currentBoard && !app.currentThread) {
        fetch('api/get/board/?id=' + app.currentBoard, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'authorization': getUserSecretKey()
            }
        }).then(async res => {
            response = await res.json();
            console.log(response);

            app.threads = response.data.threadHeaders;//[];
            app.threads.forEach(element => {
                let currThread = element;
                let textTruncated = currThread.op.text.split('\n')[0];
                currThread.id = currThread.threadId;
                currThread.op.textTruncated = textTruncated;
            }); 

            // sort these by post time
            app.threads.sort((a, b) => {
                return b.bumpTime - a.bumpTime;
            });
        }).catch(generalError);
    }
    else if (app.currentBoard && app.currentThread) {
        fetch('api/get/thread/?id=' + app.currentThread, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'authorization': getUserSecretKey()
            }
        }).then(async res => {
            response = await res.json();
            console.log(response);

            app.posts = [];
            Object.keys(response.data.posts).forEach(element => {
                app.posts.push(response.data.posts[element]);
            });

            // sort these by post time
            app.posts.sort((a, b) => {
                return a.time - b.time;
            });
        }).catch(generalError);
    }
}

function refreshUser() {
    fetch('api/get/registrationStatus/', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'authorization': getUserSecretKey()
        }
    }).then(async res => {
        response = await res.json();
        console.log(response);

        // update user data, registration time and last post
        if (response && response.data) {
            app.userData.registerTime = response.data.registerTime;
            app.userData.lastPostTime = response.data.lastPostTime;

            if(app.userData.lastPostTime > 0) {
                updateNextLocalPostTime(app.userData.lastPostTime + (60*1000));
            }

            if (Number.parseInt(app.userData.registerTime) < new Date().getTime() - (1000 * 60 * 60 * 24 * 10)) {
                app.userData.status = 'expired';
            }
            else if (Number.parseInt(app.userData.registerTime) < new Date().getTime() - (1000 * 60 * 60 * 24 * 7)) {
                app.userData.status = 'expires soon';
            }
            else {
                app.userData.status = 'registered';
            }
        }
        else {
            app.userData.status = 'unregistered';
        }
        
        bus.$emit('new-post-limit', getNextLocalPostTime());
    }).catch(generalError);
}

function startUI() {
    let url_string = window.location.href;
    let url = new URL(url_string);

    // Load current board/thread from parameters
    app.currentBoard = url.searchParams.get("board");
    app.currentThread = url.searchParams.get("thread");

    refreshUser();
    refreshUI();
}

startUI();
document.getElementById('app').classList.remove('opac-empty');