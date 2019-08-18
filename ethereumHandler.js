const credsEthNode = require('./credsEthNode.json');
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider(credsEthNode.address));
const toBN = web3.utils.toBN;
const ethereumJsUtil = require('ethereumjs-util');
const help = require('./help.js');

const abiERC20 = [{ "constant": true, "inputs": [], "name": "name", "outputs": [{ "name": "", "type": "string" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [{ "name": "_spender", "type": "address" }, { "name": "_value", "type": "uint256" }], "name": "approve", "outputs": [{ "name": "", "type": "bool" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [], "name": "totalSupply", "outputs": [{ "name": "", "type": "uint256" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [{ "name": "_from", "type": "address" }, { "name": "_to", "type": "address" }, { "name": "_value", "type": "uint256" }], "name": "transferFrom", "outputs": [{ "name": "", "type": "bool" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [], "name": "decimals", "outputs": [{ "name": "", "type": "uint8" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [{ "name": "_owner", "type": "address" }], "name": "balanceOf", "outputs": [{ "name": "balance", "type": "uint256" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "symbol", "outputs": [{ "name": "", "type": "string" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [{ "name": "_to", "type": "address" }, { "name": "_value", "type": "uint256" }], "name": "transfer", "outputs": [{ "name": "", "type": "bool" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [{ "name": "_owner", "type": "address" }, { "name": "_spender", "type": "address" }], "name": "allowance", "outputs": [{ "name": "", "type": "uint256" }], "payable": false, "stateMutability": "view", "type": "function" }, { "payable": true, "stateMutability": "payable", "type": "fallback" }, { "anonymous": false, "inputs": [{ "indexed": true, "name": "owner", "type": "address" }, { "indexed": true, "name": "spender", "type": "address" }, { "indexed": false, "name": "value", "type": "uint256" }], "name": "Approval", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "name": "from", "type": "address" }, { "indexed": true, "name": "to", "type": "address" }, { "indexed": false, "name": "value", "type": "uint256" }], "name": "Transfer", "type": "event" }];

// It just works
// https://ethereum.stackexchange.com/questions/12033/sign-message-with-metamask-and-verify-with-ethereumjs-utils
function getAddressFromSignedMessage(msg, signature) {
    const msgBuffer = ethereumJsUtil.toBuffer(msg);
    const msgHash = ethereumJsUtil.hashPersonalMessage(msgBuffer);
    const signatureBuffer = ethereumJsUtil.toBuffer(signature);
    const signatureParams = ethereumJsUtil.fromRpcSig(signatureBuffer);
    const publicKey = ethereumJsUtil.ecrecover(
        msgHash,
        signatureParams.v,
        signatureParams.r,
        signatureParams.s
    );
    const addressBuffer = ethereumJsUtil.publicToAddress(publicKey);
    const address = ethereumJsUtil.bufferToHex(addressBuffer);
    return address;
}

function EthereumHandler() {
    this.validateSignedMessage = function (_address, _message, _messageSigned) {
        try {
            let messageParsed = JSON.parse(_message);

            // If time of sign is over 15 minutes old, or in the future
            if (Number.parseInt(messageParsed['currentTime']) < (new Date().getTime() - 1000 * 60 * 15) || Number.parseInt(messageParsed['currentTime']) > (new Date().getTime() + 1)) {
                return false;
            }

            // Make sure the signed message is valid and came from the address
            let recoveredAddress = getAddressFromSignedMessage(_message, _messageSigned);
            if (recoveredAddress != _address) {
                return false;
            }

            return true;
        } catch (error) {
            help.log(error);
            return false;
        }
    }

    this.checkRequirementGetAccess = async function (address, validations) {
        let returnAccess = {};

        for (let i = 0; i < validations.length; i++) {
            let validation = validations[i]; // 
            let valid = true;
            returnAccess[validation.access] = valid;

            try {
                if (validation.req.type == 'eth') { // {req:{type:'eth', data:{over:1}}, access:'whatever'}
                    let result = await web3.eth.getBalance(address, 'latest');
                    result = toBN(result);
                    let over = toBN(validation.req.data.over);
                    if (over.gt(result)) {
                        valid = false;
                    }
                }
                else if (validation.req.type == 'erc20') { // {req:{type:'erc20', data:{address:'0x0', over:1}}, access:'whatever'}
                    let contractinstance = new web3.eth.Contract(abiERC20, validation.req.data.adderss);
                    let result = await contractinstance.methods.balanceOf(address).call();
                    result = toBN(result);
                    let over = toBN(validation.req.data.over);
                    if (over.gt(result)) {
                        valid = false;
                    }
                }
                else {
                    valid = false;
                }
            } catch (error) {
                console.log(error);
                valid = false;
            }

            returnAccess[validation.access] = returnAccess[validation.access] && valid; // If it was ever flipped to false, it'll remain false
        }

        return returnAccess;
    }
}

if (typeof module !== 'undefined') {
    module.exports = EthereumHandler
}