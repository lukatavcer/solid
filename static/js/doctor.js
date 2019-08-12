const FOAF = $rdf.Namespace('http://xmlns.com/foaf/0.1/');
const ROOT_NAME = 'example.com';
const PORT = '8443';
const ROOT_URL = 'https://' + ROOT_NAME + ':' + PORT;
const BIN_PATH = 'https://lukatavcer.example.com:8443/med-app/records/';


$('#view').click(async function loadProfile() {
    // Set up a local data store and associated data fetcher
    const store = $rdf.graph();
    const fetcher = new $rdf.Fetcher(store);

    // Load the person's data into the store
    const person = $('#profile').val();
    await fetcher.load(person);

    // Display their details
    const fullName = store.any($rdf.sym(person), FOAF('name'));
    $('#fullName').text(fullName && fullName.value);

    // Display their friends
    const friends = store.each($rdf.sym(person), FOAF('knows'));
    $('#friends').empty();
    friends.forEach(async (friend) => {
        await fetcher.load(friend);
        const fullName = store.any(friend, FOAF('name'));
        $('#friends').append(
            $('<li>').append(
                $('<a>').text(fullName && fullName.value || friend.value)
                    .click(() => $('#profile').val(friend.value))
                    .click(loadProfile)));
    });
});


$('#btn-data').click(async function () {
    const session = await solid.auth.currentSession();
    if (!session)
        alert('Hello stranger!');
    else
        alert(`Hello ${session.webId}!`);
});

fetchFriends = async () => {
    console.log('Fetching Friends')
};

addFriend = async (webId) => {
    console.log(`Adding ${webId}`);
};

removeFriend = async (webId) => {
    console.log(`Removing ${webId}`);
};

const solidClient = SolidClient;
const vocab = solidClient.vocab;

Pastebin = (function () {
    // Default publish location
    // 'https://lukatavcer.example.com:8443/med-app/records/'
    let defaultContainer = BIN_PATH;
    let WebId = 'https://lukatavcer.example.com:8443/';
    let medAppContainer = WebId + 'med-app/';
    let recordsContainer = medAppContainer + 'records/';

    // Bin structure
    let bin = {
        url: '',
        title: '',
        body: ''
    };

    async function init() {
        const session = await solid.auth.currentSession();

        if (session) {
            console.log(defaultContainer);

            containerExists(medAppContainer).then(function(exists) {
                if (!exists) {
                    createContainer(WebId, "med-app");
                }
                containerExists(recordsContainer).then(function(exists) {
                    if (!exists) {
                        createContainer(medAppContainer, "records");
                    }
                });
            });


            if (queryVals['view'] && queryVals['view'].length > 0) {
                load(queryVals['view']);
            } else if (queryVals['edit'] && queryVals['edit'].length > 0) {
                load(queryVals['edit'], true);
            } else {
                console.log('new pastebin form');
                document.getElementById('submit')
                    .setAttribute('onclick', 'Pastebin.publish()');
                document.getElementById('edit').classList.remove('hidden');
            }
        }
    }

    function load(url, showEditor) {
        solidClient.web.get(url).then(function (response) {
            let store = response.parsedGraph();

            // Set url
            bin.url = response.url;
            let subject = $rdf.sym(response.url);

            // Add title
            let title = store.any(subject, vocab.dct('title'));
            if (title) {
                bin.title = title.value;
            }

            // Add body
            let body = store.any(subject, vocab.sioc('content'));
            if (body) {
                bin.body = body.value;
            }

            if (showEditor) {
                document.getElementById('edit-title').value = bin.title;
                document.getElementById('edit-body').innerHTML = bin.body;
                document.getElementById('submit').setAttribute('onclick', 'Pastebin.update()');
                document.getElementById('edit').classList.remove('hidden');
            } else {
                document.getElementById('view-title').innerHTML = bin.title;
                document.getElementById('view-body').innerHTML = bin.body;
                document.getElementById('view').classList.remove('hidden');
            }
        }).catch(function (err) {
            console.log(err);
        });
    }

    function publish() {
        bin.title = $('#edit-title').val();
        bin.body = $('#edit-body').val();

        let store = $rdf.graph();
        let thisResource = $rdf.sym(defaultContainer);
        store.add(thisResource, vocab.dct('title'), $rdf.lit(bin.title));  // A name given to the resource.
        store.add(thisResource, vocab.sioc('content'), $rdf.lit(bin.body));  // The content of the Item in plain text format.
        let data = new $rdf.Serializer(store).toN3(store);

        // Check if patient today's med record exists, if not create new
        // Else get it and append data to it
        solidClient.web.post(defaultContainer, data, 'med_record').then(function (meta) {
            // view
            let url = meta.url;
            console.log("Url to publish: " + url);
            if (url && url.slice(0, 4) != 'http') {
                if (url.indexOf('/') === 0) {
                    url = url.slice(1, url.length);
                }
                url = defaultContainer + url.slice(url.lastIndexOf('/') + 1, url.length);
            }
            // window.location.search = "?view=" + encodeURIComponent(url);
        }).catch(function (err) {
            console.log(err);
        });

        // solid.auth.fetch(defaultContainer, {
        //     method: 'POST', // or 'PUT'
        //     headers:{
        //         'Content-Type': 'text/turtle',
        //         'Link': '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"',
        //         'Slug':  'logbook'
        //     }
        // }).then((res) => {return res;})
        //   .then((response) => {callback(null);})
        //   .catch((error) => {callback('Error: '+JSON.stringify(error));});
    }

    function update() {
        bin.title = document.getElementById('edit-title').value;
        bin.body = document.getElementById('edit-body').value;

        var graph = $rdf.graph();
        var thisResource = $rdf.sym('');
        graph.add(thisResource, vocab.dct('title'), bin.title);
        graph.add(thisResource, vocab.sioc('content'), bin.body);
        var data = new $rdf.Serializer(graph).toN3(graph);

        solidClient.web.put(bin.url, data).then(function (meta) {
            // view
            window.location.search = "?view=" + encodeURIComponent(meta.url);
        }).catch(function (err) {
            // do something with the error
            console.log(err);
        });
    }

    // Utility function to parse URL query string values
    var queryVals = (function (a) {
        if (a === "") return {};
        var b = {};
        for (var i = 0; i < a.length; ++i) {
            var p = a[i].split('=', 2);
            if (p.length === 1)
                b[p[0]] = "";
            else
                b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
        }
        return b;
    })(window.location.search.substr(1).split('&'));

    init();

    // return public functions
    return {
        publish: publish,
        update: update
    };
}(this));


function createContainer(parentUrl, containerName) {
    let options = '';
    let data = '<#this> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://rdfs.org/sioc/ns#Blog> .';
    let metadata =  `<#${containerName}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://rdfs.org/sioc/ns#Blog> .`;

    solidClient.web.createContainer(parentUrl, containerName, options, metadata).then(
        function(solidResponse) {
            // console.log(solidResponse)
            // The resulting object has several useful properties.
            // See lib/solid/response.js for details
            // solidResponse.url - value of the Location header
            // solidResponse.acl - url of acl resource
            // solidResponse.meta - url of meta resource
        }
    ).catch(function(err){
        console.log(err) // error object
    })
}

async function containerExists(url) {
    let exists = true;

    await solidClient.web.head(url).catch(function (err) {
        if (err.code === 404)
            exists = false;
    });
    return exists;
}