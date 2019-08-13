const FOAF = $rdf.Namespace('http://xmlns.com/foaf/0.1/');
// const VCARD = $rdf.Namespace("http://www.w3.org/2006/vcard/ns#");

const solidClient = SolidClient;
const vocab = solidClient.vocab;

const RDF = vocab.rdf;
const VCARD = vocab.vcard;
const DCT = vocab.dct;
const SIOC = vocab.sioc;
const XSD = vocab.xsd;


// Update components to match the user's login status
solid.auth.trackSession(session => {
    let loggedIn = !!session;
    $('#login').toggle(!loggedIn);
    $('#logout').toggle(loggedIn);
    const $userUrl = $('#user');
    if (loggedIn) {
        $('#loggedIn').toggle(true);
        $userUrl.text(session.webId);
        $userUrl.attr('href', session.webId);

        initContainer(session.webId.split('/profile')[0]);  // TODO this not good, should get app's storage from preferences (data storage)

        // Use the user's WebID as default profile
        const $profile = $('#profile');
        if (!$profile.val()) {
            $profile.val(session.webId);
        }
    } else {
        $('#loggedIn').toggle(false);
    }
});


$('#view-profile').click(async function loadProfile() {
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

// Check if user has med-app container, if not create it
async function initContainer(userUri) {
    const medAppContainer = userUri + '/med-app';
    const recordsContainer = medAppContainer + '/records';

    await containerExists(medAppContainer).then(async function(exists) {
        if (!exists) {
            // solidClient.registerApp();  // TODO
            createContainer(userUri, "med-app");
        }
        await containerExists(recordsContainer).then(function(exists) {
            if (!exists) {
                createContainer(medAppContainer, "records");
            }
        });
    });
}

async function containerExists(url) {
    let exists = true;

    await solidClient.web.head(url).catch(function (err) {
        if (err.code === 404)
            exists = false;
    });
    return exists;
}

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