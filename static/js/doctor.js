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

    async function init() {
        const session = await solid.auth.currentSession();

        if (session) {
            $('#add-record').attr('onclick', 'Record.publish()');
            $('#edit-record').attr('onclick', 'Record.update()');
        }
    }

    async function publish() {
        $('#publish-error').hide();
        const session = await solid.auth.currentSession();

        if (!session) {
            alert("Za dodajanje izvidov se je potrebno prijaviti!");
            return false;
        }

        let title = $('#publish-title').val();
        let content = $('#publish-content').val();
        let patient = $('#select-patient').val();

        if (!title || !content || !patient) {
            alert("Obrazec je nepopoln.");
            return false;
        }

        let patientStorageUri = null;

        // Get patient's profile to get his storage location
        await solidClient.getProfile(patient)
            .then(function (profile) {
                patientStorageUri = profile.storage[0];
            });

        const patientRecordsUri = patientStorageUri + 'health/records/';
        const doctorWebId = session.webId;

        // Add new medical record/report
        solidClient.web.post(patientRecordsUri).then(function (meta) {
            let newRecordUri = patientStorageUri.slice(0, -1) + meta.url;  // Combine storage root with relative new record URI

            let store = $rdf.graph();
            let newRecord = $rdf.sym(SIOC('Post'));  // Node identified by a URI
            store.add(newRecord, DCT('title'), $rdf.lit(title));  // A name given to the resource.
            store.add(newRecord, SIOC('content'), $rdf.lit(content));  // The content of the Item in plain text format.
            store.add(newRecord, DCT('created'),  $rdf.lit(moment().format(), '', XSD('dateTime')));
            store.add(newRecord, DCT('creator'),  $rdf.lit(doctorWebId));
            store.add(newRecord, DCT('rightsHolder'),  $rdf.lit(patient));

            let data = new $rdf.Serializer(store).toN3(store);

            solidClient.web.put(newRecordUri, data).then(function (meta) {
                console.log("Created resource url: " + meta.url);
                // Load & show patient's records
                loadRecords();

                clearForm();
            }).catch(function (err) {
                console.log(err);
            });
        }).catch(function (err) {
            console.log(err);
            $('#publish-error').show();
        });

        $('#add-record').blur();
    }

    function update() {
        let uri = $('#selected-record').val();
        let record = recordsData[uri];

        let title = $('#edit-title').val();
        let content = $('#edit-content').val();

        let store = $rdf.graph();
        let editRecord = $rdf.sym(SIOC('Post'));  // Node identified by a URI

        store.add(editRecord, DCT('title'), $rdf.lit(title));
        store.add(editRecord, SIOC('content'), $rdf.lit(content));
        store.add(editRecord, DCT('created'),  $rdf.lit(record.created, '', XSD('dateTime')));
        store.add(editRecord, DCT('modified'),  $rdf.lit(moment().format(), '', XSD('dateTime')));
        store.add(editRecord, DCT('creator'),  $rdf.lit(record.doctorWebId));
        store.add(editRecord, DCT('rightsHolder'),  $rdf.lit(record.patient));

        let data = new $rdf.Serializer(store).toN3(store);

        solidClient.web.put(uri, data).then(function (meta) {
            // view
            loadRecords();

            $('#edit-record-modal').modal('hide');
        }).catch(function (err) {
            console.log(err);
        });
    }

    function clearForm() {
        $('#publish-title').val('');
        $('#publish-content').val('');
    }

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
                $(`<button type="button" class="list-group-item" title="${patient.value}" onClick="loadPatient('${patient.value}')">${nameOrUri}</button>`)
            );

            $selectPatients.append(
                $(`<option value="${patient.value}">${nameOrUri}</option>`)
            );
        });
    } else {
        $patientsLoader.hide();
    }
}

// Patient profiles
let patients = {};

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

                if (!patients[patientWebId]) {
                    patients[patientWebId] = CurrentPatient;
                }

                // Set patient for a new record
                $('#select-patient').val(patientWebId);
                $('#profile-search').val(patientWebId);
            }).catch(function (err) {
                $('#profile-search-error').show();
                $('#profile-data').hide();
            });
    } else {
        $('#profile-data').hide();
    }
    $('.list-group-item').blur();
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
    $('#publish-form, #edit-form, #profile-search-form').on('submit', function(e) {
        e.preventDefault();
    });
});

$('#records').on('click', '.media', function() {
    let uri = this.id;
    let record = recordsData[uri];
    $('#selected-record').val(uri);
    $('#selected-patient').val(patients[record.patient].name);
    $('#edit-title').val(record.title);
    $('#edit-content').val(record.content);

    $('#edit-record-modal').modal('show');
});