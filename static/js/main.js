const DBO = $rdf.Namespace('http://dbpedia.org/ontology/');

const solidClient = SolidClient;
const vocab = solidClient.vocab;

const FOAF = vocab.foaf;
const RDF = vocab.rdf;
const VCARD = vocab.vcard;
const DCT = vocab.dct;
const SIOC = vocab.sioc;
const XSD = vocab.xsd;
const ACL = vocab.acl;

const LoggedUser = {
    webId: null,
    name: null,
    storage: null,
    image: null,
    clear: function clear() {
        this.webId = null;
        this.name = null;
        this.storage = null;
        this.image = null;
    }
};

// Check if user has health data, if not create it
async function initApp(userWebId) {
    await solidClient.getProfile(userWebId)
        .then(function (profile) {
            LoggedUser.name = profile.name;
            LoggedUser.image = profile.picture;
            LoggedUser.storage = profile.storage[0];
        });

    const healthContainer = LoggedUser.storage + 'health';
    const recordsContainer = healthContainer + '/records';

    // Create health container
    await containerExists(healthContainer).then(async function(exists) {
        if (!exists) {
            // solidClient.registerApp();  // TODO

            // Create container health and ACL files for health container
            await createACL(LoggedUser.storage, LoggedUser.webId);
        }
    });

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
            return solidResponse.url
        }).catch(function(err){
            console.log(err) // error object
        });
}

async function createACL (userStorageUri, userWebId) {
    let content =
        `@prefix  acl:  <http://www.w3.org/ns/auth/acl#>.

# The owner has all of the access modes allowed
<#owner>
    a acl:Authorization;
    acl:agent <${userWebId}>;
    acl:accessTo <./>;
    acl:default <./>;
    acl:mode
        acl:Read, acl:Write, acl:Control.

# Group authorization, giving Read/Write access to members of the Doctor group
<#authorization2>
    a               acl:Authorization;
    acl:accessTo    <./>;
    acl:mode        acl:Read,
                    acl:Write;
    acl:default <./>;
    acl:agentGroup  <https://example.com:8443/groups.ttl#Doctor>.`;

    await solidClient.web.put(userStorageUri+'health/.acl', content).then(function (meta) {
        return meta.url;
    }).catch(function (err) {
        console.log(err);
    });
}

// App registry
async function test() {
    solidClient.getProfile('https://lukatavcer.example.com:8443/profile/card#me')
        .then(function (profile) {
            console.log(profile.name);

            profile.loadAppRegistry();

            // The profile has been updated, app registry loaded. Now you can register apps with is.
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
            let app = registrationResults[0];
            console.log(app.name);  // -> 'Contact Manager'
            console.log(app.shortdesc);  // -> ...
            console.log(app.redirectTemplateUri);
        });
}