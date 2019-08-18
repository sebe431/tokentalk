Date.prototype.toStringShort = function () {
    return this.getFullYear() +
        "/" + ((this.getMonth() + 1) > 9 ? (this.getMonth() + 1) : ('0' + (this.getMonth() + 1))) +
        "/" + (this.getDate() > 9 ? this.getDate() : ('0' + this.getDate())) +
        " " + (this.getHours() > 9 ? this.getHours() : ('0' + this.getHours())) +
        ":" + (this.getMinutes() > 9 ? this.getMinutes() : ('0' + this.getMinutes()));
}

Date.prototype.toStringShortTime = function () {
    return (this.getHours() > 9 ? this.getHours() : ('0' + this.getHours())) +
        ":" + (this.getMinutes() > 9 ? this.getMinutes() : ('0' + this.getMinutes()));
}

Date.prototype.toStringSystem = function () {
    return this.getUTCFullYear() + '-' +
        ((this.getUTCMonth() + 1) > 9 ? '' : '0') + (this.getUTCMonth() + 1) + '-' +
        (this.getUTCDate() > 9 ? '' : '0') + this.getUTCDate() + 'T' +
        (this.getUTCHours() > 9 ? '' : '0') + this.getUTCHours() + ':' +
        (this.getUTCMinutes() > 9 ? '' : '0') + this.getUTCMinutes() + ':' +
        (this.getUTCSeconds() > 9 ? '' : '0') + this.getUTCSeconds();
}

function log(text1, text2) {
    if (!text2) {
        console.log(new Date().toStringSystem(), text1);
    }
    else {
        console.log(new Date().toStringSystem(), text1, text2);
    }
}

function setIntervalAsyncStartSkip(cb, timer, expirationTimer) {
    let started = false;
    let startedTimeout;

    let func = async function () {
        if (!started) {
            started = true;
            startedTimeout = setTimeout(function () { started = false; }, (expirationTimer ? expirationTimer : (timer * 3)));
            cb(function () { started = false; clearTimeout(startedTimeout); });
        }
    }

    let intervalId = setInterval(func, timer);
    func();
    return intervalId;
}

function getRandomStr8() {
    return Math.random().toString(36).replace(/[^a-z0-9]+/g, '').substr(2, 10);
}

if (typeof module !== 'undefined') {
    module.exports = {
        setIntervalAsyncStartSkip: setIntervalAsyncStartSkip,
        log: log,
        getRandomStr8: getRandomStr8
    }
}