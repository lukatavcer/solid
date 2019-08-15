const ROOT_NAME = 'example.com';
const PORT = '8443';
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

$('#view-profile').click(function() {
    loadPatient($('#profile-search').val());
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

        if (!record.title || !record.body || !record.patient) {
            alert("Obrazec je nepopoln.");
            return false;
        }

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
            let newRecord = $rdf.sym(SIOC('Post'));  // Node identified by a URI
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
    name: '',
    image: '/static/img/doc_default.png',
    gender: '/',
    birthDate: '/',
    clear: function() {
        this.webId = null;
        this.storage = null;
        this.name = '';
        this.image = '/static/img/doc_default.png';
        this.gender = '/';
        this.birthDate = '/';
    }
};

async function loadPatient(patientWebId) {
    CurrentPatient.clear();

    $('#profile-search-error').hide();
    const session = await solid.auth.currentSession();
    if (session) {
        // Get patient's storage location
        await solidClient.getProfile(patientWebId)
            .then(function (profile) {
                let patient = $rdf.sym(patientWebId);

                CurrentPatient.webId = patientWebId;
                CurrentPatient.storage = profile.storage[0];

                let gender = profile.parsedGraph.any(patient, FOAF('gender'));
                let birthDate = profile.parsedGraph.any(patient, DBO('birthDate'));

                if (profile.name)  CurrentPatient.name = profile.name;
                if (profile.picture)  CurrentPatient.image = profile.picture;
                if (gender) CurrentPatient.gender = gender.value;
                if (birthDate) CurrentPatient.birthDate = moment(birthDate.value).format('D. M. YYYY');

                // Show profile data
                $('#profile-name').text(CurrentPatient.name);
                $('#profile-img').prop('src', CurrentPatient.image);
                $('#profile-gender').text(CurrentPatient.gender);
                $('#profile-birth-date').text(CurrentPatient.birthDate);

                $('#profile-data').show();

                // Load & show patient's records
                loadRecords();

                // Set patient for a new record
                $('#select-patient').val(patientWebId);
                $('#profile-search').val(patientWebId);
            }).catch(function (err) {
                $('#profile-search-error').show();
                $('#profile-data').hide();
                $('#view-profile').blur();
            });
    } else {
        $('#profile-data').hide();
    }
}

async function loadRecords() {
    if (!CurrentPatient.webId) {
        alert("Izberi pacienta.");
        $('#btn-load-records').blur();
        return false;
    }
    const url = CurrentPatient.storage + 'health/records/';
    _loadRecords(url)
}

$(document).ready(function() {
    $('#publish-form, #profile-search-form').on('submit', function(e) {
        e.preventDefault();
    });
});