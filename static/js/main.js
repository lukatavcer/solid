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
    storage: null,
    name: '',
    image: '/static/img/doc_default.png',
    clear: function clear() {
        this.webId = null;
        this.storage = null;
        this.name = '';
        this.image = '/static/img/doc_default.png';
    }
};


// Dictionary of doctors data and images that wrote medical records
const doctors = {};

// Check if user has health data, if not create it
async function initApp(userWebId) {
    await solidClient.getProfile(userWebId)
        .then(function (profile) {
            if (profile.name) LoggedUser.name = profile.name;
            if (profile.picture) LoggedUser.image = profile.picture;
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

# Group authorization, giving Read/Write access to members of the Emergency group
<#emergency>
    a               acl:Authorization;
    acl:accessTo    <./>;
    acl:mode        acl:Read,
                    acl:Write;
    acl:default <./>;
    acl:agentGroup  <https://example.com:8443/groups.ttl#Emergency>.
`;

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

// Records
const recordsData = {};

async function _loadRecords(url) {
    const $recordsLoader = $('#records-loader');
    const $records = $('#records');
    $records.empty();
    $recordsLoader.show();

    const session = await solid.auth.currentSession();

    if (session) {
        // Array of records, later used to sort them by datetime created
        const records = [];

        solidClient.web.get(url)
            .then(async function(response) {
                const store = $rdf.graph();
                const fetcher = new $rdf.Fetcher(store);

                async function fetchRecords() {
                    for (let i=0; i<response.contentsUris.length; i++) {
                        let resource = response.contentsUris[i];

                        let record = $rdf.sym(resource);
                        await fetcher.load(resource);

                        let title = store.any(SIOC('Post'), DCT('title'), undefined, record).value;
                        let content = store.any(SIOC('Post'), SIOC('content'), undefined, record).value;
                        let created = store.any(SIOC('Post'), DCT('created'), undefined, record).value;
                        let doctorWebId = store.any(SIOC('Post'), DCT('creator'), undefined, record).value;
                        let patient = store.any(SIOC('Post'), DCT('rightsHolder'), undefined, record).value;

                        // Get doctor's data (name, image...)
                        let doctorName = doctorWebId;
                        let doctorImage = "/static/img/doc_default.png";

                        if (doctors[doctorWebId]) {
                            doctorName = doctors[doctorWebId].name || doctorWebId;
                            doctorImage = doctors[doctorWebId].image || doctorImage;
                        } else {
                            // Fetch doctor's data
                            await fetcher.load(doctorWebId);
                            let name = store.any($rdf.sym(doctorWebId), FOAF('name'));
                            let image = store.any($rdf.sym(doctorWebId), FOAF('img'));
                            if (image) {
                                doctorImage = image.value;
                            }
                            if (name) {
                                doctorName = name.value;
                            }
                            // Cache doctor to doctors dictionary
                            doctors[doctorWebId] = {
                                name: doctorName,
                                image: doctorImage
                            }
                        }

                        let recordData = {
                            title: title,
                            content: content,
                            created: created,
                            patient: patient,
                            doctorWebId: doctorWebId,
                            doctor: doctorName,
                            doctorImage: doctorImage,
                            uri: resource
                        };

                        // Global
                        recordsData[resource] = recordData;
                        // Local just to sort
                        records.push(recordData);
                    }
                }

                // Get all records from patient's data pod
                await fetchRecords();

                // Sort records by datetime created
                records.sort(function compare(a, b) {
                    if (new Date(a.created) > new Date(b.created))
                        return 1;
                    return -1;
                });

                $recordsLoader.hide();

                $.each(records, function(index, r) {
                    $records.append(
                        $(`
                        <div class="media" id="${r.uri}" data-patient="${r.patient}">
                            <div class="media-left">
                                <a href="#">
                                    <img class="media-object" data-src="favicon.ico" alt="64x64" src="${r.doctorImage}" data-holder-rendered="true" style="width: 64px; height: 64px;">
                                </a>
                            </div>
                            <div class="media-body">
                                <h4 class="media-heading" style="margin-bottom: 10px;">
                                    <span class="font-bold record-title">${r.title}</span> - ${r.doctor}
                                    <span class="date">(${moment(r.created).format('D. M. YYYY, H:mm')})</span>
                                    <span class="record-date" hidden>${r.created}</span>
                                </h4>
                                <span class="record-content">${r.content}</span>
                            </div>
                        </div>
                        `)
                    );
                });
            })
            .catch(function(err) {
                console.log(err) // error object
            });
    } else {
        $recordsLoader.hide();
    }
}