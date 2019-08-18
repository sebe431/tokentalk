const Validator = new require('jsonschema').Validator;
const v = new Validator();

let schemaIdSchema = {
    "type": "string"
}

let schemaCollection = {
    'post': {
        "id": "/SimplePost",
        "type": "object",
        "properties": {
            "boardId": {"type": "string"},
            "threadId": {"type": "string"},
            "text": {"type": "string"}
        },
        "required": ["board", "text"]
    },
    'register': {
        "id": "/SimplePost",
        "type": "object",
        "properties": {
            "address": {"type":"string"},
            "message": {"type": "string"},
            "messageSigned": {"type": "string"}
        },
        "required": ["message", "messageSigned"]
    }
}

let manualValidations = {
    'post': function(data) {
        return data.text.length>0 && data.text.length<2000;
    }
}

function ValidatorWrapper() {
    this.validate = function (data, schemaId) {
        return v.validate(schemaId, schemaIdSchema) && schemaCollection[schemaId] && v.validate(data, schemaCollection[schemaId]) && (!manualValidations[schemaId] || manualValidations[schemaId](data));
    }
}

let instance = null;
function getInstance() {
    instance = instance || new ValidatorWrapper();
    return instance;
}

if (typeof module !== 'undefined') {
    module.exports = getInstance
}