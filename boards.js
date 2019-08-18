function Boards() {
    let boardsMeta = {
        'meta': {
            id: 'meta',
            desc: 'Discuss anything related to tokentalk itself, suggestions, issues, etc [Registration NOT required]',
            reqs: [], 
            maxThreads: 100,
            maxPosts: 300
        },
        'random': {
            id: 'random',
            desc: 'Talk about anything',
            reqs: [{type:'registration'}], // registration only example
            maxThreads: 100,
            maxPosts: 300
        },
        'eth': {
            id: 'eth',
            desc: 'Ethereum ETH >1',
            reqs: [{type:'registration'}, {type:'eth', data:{over:'1000000000000000000'}}], // ethereum example
            maxThreads: 100,
            maxPosts: 300
        },
        'link100': {
            id: 'link100',
            desc: 'ChainLink LINK holders >100',
            reqs: [{type:'registration'}, {type:'erc20', data:{adderss:'0x514910771af9ca656af840dff83e8264ecf986ca',over:'100000000000000000000'}}], // erc20 example
            maxThreads: 100,
            maxPosts: 300
        },
        'link10k': {
            id: 'link10k',
            desc: 'ChainLink LINK holders >10,000',
            reqs: [{type:'registration'}, {type:'erc20', data:{adderss:'0x514910771af9ca656af840dff83e8264ecf986ca',over:'10000000000000000000000'}}],
            maxThreads: 100,
            maxPosts: 300
        },
        'mkr1': {
            id: 'mkr1',
            desc: 'MakerDAO MKR holders >1',
            reqs: [{type:'registration'}, {type:'erc20', data:{adderss:'0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2',over:'1000000000000000000'}}],
            maxThreads: 100,
            maxPosts: 300
        },
        'bat100': {
            id: 'bat100',
            desc: 'Basic Attention Token BAT holders >100',
            reqs: [{type:'registration'}, {type:'erc20', data:{adderss:'0x0d8775f648430679a709e98d2b0cb6250d2887ef',over:'10000000000000000000000'}}],
            maxThreads: 100,
            maxPosts: 300
        },
    }

    this.getBoardsMeta = function() {
        return boardsMeta;
    }

    this.getSimpleBoardMeta = function(boardKey) { // TODOL: Might as well cache this, and add tags that are derived from requirements
        return {
            id: boardsMeta[boardKey].id,
            desc: boardsMeta[boardKey].desc
        };
    }
}

if (typeof module !== 'undefined') {
    module.exports = Boards
}