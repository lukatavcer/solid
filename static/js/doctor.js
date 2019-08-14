const ROOT_NAME = 'example.com';
const PORT = '8443';
const ROOT_URL = 'https://' + ROOT_NAME + ':' + PORT;
const BIN_PATH = 'https://lukatavcer.example.com:8443/health/records/';

// Update components to match the user's login status
solid.auth.trackSession(async function(session) {
    let loggedIn = !!session;

    const $userUrl = $('#user');
    if (loggedIn) {
        $('#loggedIn').toggle(true);
        $userUrl.text(session.webId);
        $userUrl.attr('href', session.webId);

        LoggedUser.webId = session.webId;

        // Initialize app data
        await initApp(session.webId);

        // Load patient's health records
        await loadPatients();

        // Use the user's WebID as default profile
        const $profile = $('#profile');
        if (!$profile.val()) {
            $profile.val(session.webId);
        }
    }
});

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

Record = (function () {
    // Default publish location
    let defaultContainer = BIN_PATH;
    let WebId = 'https://lukatavcer.example.com:8443/';
    let healthContainer = WebId + 'health/';
    let recordsContainer = healthContainer + 'records/';

    // Record structure
    let record = {
        url: '',
        title: '',
        body: '',
        patient: '',
    };

    async function init() {
        const session = await solid.auth.currentSession();

        if (session) {
            console.log(defaultContainer);

            if (queryVals['view'] && queryVals['view'].length > 0) {
                load(queryVals['view']);
            } else if (queryVals['edit'] && queryVals['edit'].length > 0) {
                load(queryVals['edit'], true);
            } else {
                $('#add-record').attr('onclick', 'Record.publish()');
                $('#edit').removeClass('hidden');
            }
        }
    }

    function load(url, showEditor) {
        solidClient.web.get(url).then(function (response) {
            let store = response.parsedGraph();

            // Set url
            record.url = response.url;
            let subject = $rdf.sym(response.url);

            // Add title
            let title = store.any(subject, DCT('title'));
            if (title) {
                record.title = title.value;
            }

            // Add body
            let body = store.any(subject, SIOC('content'));
            if (body) {
                record.body = body.value;
            }

            if (showEditor) {
                $('#edit-title').val(record.title);
                $('#edit-body').html(record.body);
                $('#submit').attr('onclick', 'Record.update()');
                $('#edit').removeClass('hidden');
            } else {
                $('#view-title').html(record.title);
                $('#view-body').html(record.body);
                $('#view-publish').removeClass('hidden');
            }
        }).catch(function (err) {
            console.log(err);
        });
    }

    async function publish() {
        const session = await solid.auth.currentSession();

        if (!session) {
            alert("Za dodajanje izvidov se je potrebno prijaviti!");
            return false;
        }

        record.title = $('#edit-title').val();
        record.body = $('#edit-body').val();
        record.patient = $('#select-patient').val();


        let patientStorageUri = null;

        // Get patient's profile to get his storage location
        await solidClient.getProfile(record.patient)
            .then(function (profile) {
                patientStorageUri = profile.storage[0];
            });

        const patientRecordsUri = patientStorageUri + 'health/records/';
        const doctorWebId = session.webId;

        // Add new medical record/report
        solidClient.web.post(patientRecordsUri).then(function (meta) {
            let newRecordUri = patientStorageUri.slice(0, -1) + meta.url;  // Combine storage root with relative new record URI

            let store = $rdf.graph();
            // let newRecord = $rdf.sym(newRecordUri);  // Node identified by a URI
            let newRecord = $rdf.sym(SIOC('post'));  // Node identified by a URI
            store.add(newRecord, DCT('title'), $rdf.lit(record.title));  // A name given to the resource.
            store.add(newRecord, SIOC('content'), $rdf.lit(record.body));  // The content of the Item in plain text format.
            store.add(newRecord, DCT('created'),  $rdf.lit(moment().format(), '', XSD('dateTime')));
            store.add(newRecord, DCT('creator'),  $rdf.lit(doctorWebId));

            let data = new $rdf.Serializer(store).toN3(store);

            solidClient.web.put(newRecordUri, data).then(function (meta) {
                let url = meta.url;
            }).catch(function (err) {
                console.log(err);
            });
            // if (url && url.slice(0, 4) != 'http') {
            //     if (url.indexOf('/') === 0) {
            //         url = url.slice(1, url.length);
            //     }
            //     url = defaultContainer + url.slice(url.lastIndexOf('/') + 1, url.length);
            // }
            // // window.location.search = "?view=" + encodeURIComponent(url);
        }).catch(function (err) {
            console.log(err);
        });
    }

    function update() {
        record.title = $('#edit-title').val();
        record.body = $('#edit-body').val();

        var graph = $rdf.graph();
        var thisResource = $rdf.sym('');
        graph.add(thisResource, DCT('title'), record.title);
        graph.add(thisResource, SIOC('content'), record.body);
        var data = new $rdf.Serializer(graph).toN3(graph);

        solidClient.web.put(record.url, data).then(function (meta) {
            // view
            window.location.search = "?view=" + encodeURIComponent(meta.url);
        }).catch(function (err) {
            // do something with the error
            console.log(err);
        });
    }

    // Utility function to parse URL query string values
    var queryVals = (function (a) {
        if (a == "") return {};
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

$('#test-view').click(function() {
    let url = 'https://lukatavcer.example.com:8443/health/records/record.ttl';
    solidClient.web.get(url)
        .then(function(response) {
            const store = response.parsedGraph();
            // Print all statements matching resources of type foaf:Post
            console.log(store.statementsMatching(undefined, RDF('type'), SIOC('Post')))
        })
        .catch(function(err) {
            console.log(err) // error object
        })
});

async function loadPatients() {
    const $patientsLoader = $('#patients-loader');
    const $patients = $('#patients');
    const $selectPatients = $('#select-patient');

    $patients.empty();
    $selectPatients.empty();
    $patientsLoader.show();

    const session = await solid.auth.currentSession();
    if (session) {
        console.log(`Hello ${session.webId}!`);

        // Set up a local data store and associated data fetcher
        const store = $rdf.graph();
        const fetcher = new $rdf.Fetcher(store);

        const patientGroup = store.sym('https://example.com:8443/groups.ttl#Patient');

        // Fetch patients into the store
        await fetcher.load('https://example.com:8443/groups.ttl');
        const patients = store.each(patientGroup, VCARD('hasMember'));  // (subject, predicate, object, document)

        // Display patients
        $patientsLoader.hide();

        // TODO add sort/order by
        patients.forEach(async (patient) => {
            await fetcher.load(patient);
            let fullName = store.any(patient, FOAF('name'));
            let nameOrUri = (fullName && fullName.value || patient.value);

            $patients.append(
                $(`<li class="list-group-item" title="${patient.value}">
<button type="button" class="badge badge-success">Nov izvid</button>
<button type="button" class="badge badge-def" onClick="loadPatient('${patient.value}')">Profil</button>${nameOrUri}</li>`)
            );

            $selectPatients.append(
                $(`<option value="${patient.value}">${nameOrUri}</option>`)
            );
        });
    } else {
        $patientsLoader.hide();
    }
}

let CurrentPatient = {
    webId: null,
    storage: null,
    name: null,
    img: null,
};

async function loadPatient(patientWebId) {
    const session = await solid.auth.currentSession();
    if (session) {
        // Get patient's storage location
        await solidClient.getProfile(patientWebId)
            .then(function (profile) {
                CurrentPatient.webId = patientWebId;
                CurrentPatient.name = profile.name;
                CurrentPatient.storage = profile.storage[0];
            });

        // Load & show patient's records
        await loadRecords();
    }
}

// Dictionary of images & other data of doctors that wrote medical records
const doctors = {};

async function loadRecords() {
    if (!CurrentPatient.webId) {
        alert("Izberi pacienta.");
        $('#btn-load-records').blur();
        return false;
    }

    const $recordsLoader = $('#records-loader');
    const $records = $('#records');
    $records.empty();
    $recordsLoader.show();

    const session = await solid.auth.currentSession();
    if (session) {
        const url = CurrentPatient.storage + 'health/records/';

        solidClient.web.get(url)
            .then(function(response) {
                const store = $rdf.graph();
                const fetcher = new $rdf.Fetcher(store);

                $recordsLoader.hide();
                // TODO sort by datetime created
                response.contentsUris.forEach(async (resource) => {
                    let record = $rdf.sym(resource);
                    await fetcher.load(resource);
                    let title = store.any(SIOC('Post'), DCT('title'), undefined, record).value;
                    let content = store.any(SIOC('Post'), SIOC('content'), undefined, record).value;
                    let created = store.any(SIOC('Post'), DCT('created'), undefined, record).value;
                    let doctorWebId = store.any(SIOC('Post'), DCT('creator'), undefined, record).value;

                    // Get doctor's data (name, image...)
                    let doctor = doctorWebId;
                    let doctorImage = "/static/img/doc_default.png";

                    if (doctors[doctorWebId]) {
                        doctor = doctors[doctorWebId].name || doctor;
                        doctorImage = doctors[doctorWebId].image || doctorImage;
                    } else {
                        // Fetch doctor's data
                        await fetcher.load(doctorWebId);
                        doctor = store.any($rdf.sym(doctorWebId), VCARD('fn')).value;
                        let image = store.any($rdf.sym(doctorWebId), FOAF('img'));
                        if (image) {
                            doctorImage = image.value;
                        }

                        // Cache doctor to doctors dictionary
                        doctors[doctorWebId] = {
                            name: doctor,
                            image: doctorImage
                        }
                    }

                    $records.append(
                        $(`
                        <div class="media">
                            <div class="media-left">
                                <a href="#">
                                    <img class="media-object" data-src="favicon.ico" alt="64x64" src="${doctorImage}" data-holder-rendered="true" style="width: 64px; height: 64px;">
                                </a>
                            </div>
                            <div class="media-body">
                                <h4 class="media-heading" style="margin-bottom: 10px;">
                                    <span class="font-bold">${title}</span> - ${doctor}
                                    <span class="date">(${moment(created).format('d. M. YYYY, h:mm')})</span>
                                </h4>
                                ${content}
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