const FOAF = $rdf.Namespace('http://xmlns.com/foaf/0.1/');
// const VCARD = $rdf.Namespace("http://www.w3.org/2006/vcard/ns#");

const solidClient = SolidClient;
const vocab = solidClient.vocab;

const RDF = vocab.rdf;
const VCARD = vocab.vcard;
const DCT = vocab.dct;
const SIOC = vocab.sioc;
const XSD = vocab.xsd;
const ACL = vocab.acl;

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

        initApp(session.webId.split('/profile')[0]);  // TODO this not good, should get app's storage from preferences (data storage)

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

// Check if user has health data, if not create it
async function initApp(userUri) {
    const healthContainer = userUri + '/health';
    const recordsContainer = healthContainer + '/records';

    // Create health container
    await containerExists(healthContainer).then(async function(exists) {
        if (!exists) {
            // solidClient.registerApp();  // TODO
            await createContainer(userUri, "health");
        }
    });

    // Create ACL files for health container
    await createACL(healthContainer);

    // Create records container
    await containerExists(recordsContainer).then(async function(exists) {
        if (!exists) {
            await createContainer(healthContainer, "records");
        }
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

async function createContainer(parentUrl, containerName) {
    let options = '';
    // let metadata =  `<#${containerName}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://rdfs.org/sioc/ns#Blog> .`;

    await solidClient.web.createContainer(parentUrl, containerName, options)
        .then(function(solidResponse) {
            console.log(solidResponse.url)
            return solidResponse.url
        }).catch(function(err){
            console.log(err) // error object
        });
    console.log("createContainer finish")
}
async function test() {
    let ns = vocab;
    solidClient.getProfile('https://lukatavcer.example.com:8443/profile/card#me')
        .then(function (profile) {
        console.log(profile.name);  // -> 'Alice'

        profile.loadAppRegistry()
        // })
        // .then(function (profile) {
            // The profile has been updated, app registry loaded. Now you can register
            // apps with is.
            let options = {
                name: 'Health application',
                shortdesc: 'A health app',
                redirectTemplateUri: 'https://solid.github.io/contacts/?uri={uri}',
                registrationUri: 'https://example.com:8443/register'
            };
            let typesForApp = [ VCARD('AddressBook') ];
            let isListed = true;
            let app = new solidClient.AppRegistration(options, typesForApp, isListed);
            profile.registerApp(app);

            let registrationResults = profile.appsForType(VCARD('AddressBook'));
            let app2 = registrationResults[0];
            return profile.registerApp(app)
        })
        .then(function (profile) {
            // The app entry was created. You can now query the registry for it
            return profile.appsForType(VCARD('AddressBook'))
        })
        .then(function (registrationResults) {
            let app = registrationResults[0]
            console.log(app.name);  // -> 'Contact Manager'
            console.log(app.shortdesc);  // -> ...
            console.log(app.redirectTemplateUri);
        });

    // solidClient.login()
    //     .then(function (webId) {
    //         return solidClient.getProfile(webId)
    // //     })
    //     .then(function (profile) {
    //         return profile.loadAppRegistry()
    //     })
    //     .then(function (profile) {
    //         // The profile has been updated, app registry loaded. Now you can register
    //         // apps with is.
    //         let options = {
    //             name: 'Health application',
    //             shortdesc: 'A health app',
    //             redirectTemplateUri: 'https://solid.github.io/contacts/?uri={uri}'
    //         };
    //         let typesForApp = [ VCARD('AddressBook') ];
    //         let isListed = true;
    //         let app = new solidClient.AppRegistration(options, typesForApp, isListed);
    //         return profile.registerApp(app)
    //     })
    //     .then(function (profile) {
    //         // The app entry was created. You can now query the registry for it
    //         return profile.appsForType(VCARD('AddressBook'))
    //     })
    //     .then(function (registrationResults) {
    //         let app = registrationResults[0]
    //         console.log(app.name);  // -> 'Contact Manager'
    //         console.log(app.shortdesc);  // -> ...
    //         console.log(app.redirectTemplateUri);
    //     })
}

async function test2() {
    let exists = true;
    let url = 'https://lukatavcer.example.com:8443/health/';
    //
    // await solidClient.getPermissions(url)
    //     .then(function (permissionSet) {
    //         // Now the permission set, parsed from `hello-world.acl` is loaded,
    //         // and you can iterate over the individual authorizations
    //         permissionSet.forEach(function (auth) {
    //             if (auth.isAgent()) {
    //                 console.log('agent webId: ' + auth.agent)
    //             } else if (auth.isPublic()) {
    //                 // this permission is for everyone (acl:agentClass foaf:Agent)
    //             } else if (auth.isGroup()) {
    //                 console.log('agentClass webId: ' + auth.group)
    //             }
    //             // You can also use auth.webId() for all cases:
    //             console.log('agent/group webId: ' + auth.webId())
    //             // You can check what sort of access modes are granted:
    //             auth.allowsRead()  // -> true if the authorization contains acl:Read mode
    //             auth.allowsWrite()
    //             auth.allowsAppend()
    //             auth.allowsControl()
    //             // Check to see if this Authorization is inherited (`acl:default`)
    //             auth.isInherited()  // -> false for a resource, usually true for container
    //             // Check to see if access is allowed from a given Origin
    //             auth.allowsOrigin('https://example.com')
    //         })
    //     })
    //
    // await solidClient.web.get(url).then(
    //     function(solidResponse) {
    //         console.log(solidResponse.acl); // the ACL uri
    //         if (!solidResponse.exists()) {
    //             console.log("This resource doesn't exist")
    //         } else if (solidResponse.xhr.status === 403) {
    //             if (solidResponse.isLoggedIn()) {
    //                 console.log("You don't have access to the resource")
    //             } else {
    //                 console.log("Please authenticate")
    //             }
    //         }
    //     }
    // );

    // let store = $rdf.graph();
    // // let newRecord = $rdf.sym(newRecordUri);  // Node identified by a URI
    // // let acl = $rdf.sym(ACL);  // Node identified by a URI
    // let acl = $rdf.blankNode('authorisation3');
    //
    // store.add(acl, ACL('a'), ACL('Authorization'));
    // store.add(acl, ACL('accessTo'), $rdf.sym(url));  // A name given to the resource.
    // store.add(acl, ACL('mode'), ACL('read'));
    // store.add(acl, ACL('mode'), ACL('write'));
    // store.add(acl, ACL('mode'), ACL('control'));
    // store.add(acl, ACL('default'),  $rdf.sym(url));
    // store.add(acl, ACL('agentGroup'),  $rdf.sym('https://example.com:8443/groups.ttl#Doctor'));
    //
    // let data = new $rdf.Serializer(store).toN3(store);
    //
    // console.log(data);
    // solidClient.web.put(url, data, '.acl').then(function (meta) {
    //     // view
    //     let url = meta.url;
    // }).catch(function (err) {
    //     console.log(err);
    // });
    // return exists;
}

async function createACL (resource) {
    let content =
`@prefix  acl:  <http://www.w3.org/ns/auth/acl#>.

# Group authorization, giving Read/Write access to members of the Doctor group
<#authorization2>
    a               acl:Authorization;
    acl:accessTo    <./>;
    acl:mode        acl:Read,
                    acl:Write;
    acl:default <./>;
    acl:agentGroup  <https://example.com:8443/groups.ttl#Doctor>.`;

    await solidClient.web.put(resource+'/.acl', content).then(function (meta) {
        return meta.url;
    }).catch(function (err) {
        console.log(err);
    });
}