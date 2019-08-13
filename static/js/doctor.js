const ROOT_NAME = 'example.com';
const PORT = '8443';
const ROOT_URL = 'https://' + ROOT_NAME + ':' + PORT;
const BIN_PATH = 'https://lukatavcer.example.com:8443/med-app/records/';

$(document).ready(function() {
    loadPatients();
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

fetchFriends = async () => {
    console.log('Fetching Friends')
};

addFriend = async (webId) => {
    console.log(`Adding ${webId}`);
};

removeFriend = async (webId) => {
    console.log(`Removing ${webId}`);
};



Record = (function () {
    // Default publish location
    let defaultContainer = BIN_PATH;
    let WebId = 'https://lukatavcer.example.com:8443/';
    let medAppContainer = WebId + 'med-app/';
    let recordsContainer = medAppContainer + 'records/';

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

        const doctorWebId = session.webId;
        const patientStorageUri = record.patient.split('/profile')[0];  // TODO this not good, should get app's storage from preferences (data storage)
        const patientRecordsUri = patientStorageUri + '/med-app/records/';


        // Check if user already has initialized container med-app/records, if not create them
        await initContainer(patientStorageUri);

        // Add new medical record/report
        solidClient.web.post(patientRecordsUri).then(function (meta) {
            let newRecordUri = patientStorageUri + meta.url;  // Combine storage root with relative new record URI

            let store = $rdf.graph();
            // let newRecord = $rdf.sym(newRecordUri);  // Node identified by a URI
            let newRecord = $rdf.sym(SIOC('post'));  // Node identified by a URI
            store.add(newRecord, DCT('title'), $rdf.lit(record.title));  // A name given to the resource.
            store.add(newRecord, SIOC('content'), $rdf.lit(record.body));  // The content of the Item in plain text format.
            store.add(newRecord, DCT('created'),  $rdf.lit(moment().format(), '', XSD('dateTime')));
            store.add(newRecord, DCT('creator'),  $rdf.lit(doctorWebId));

            let data = new $rdf.Serializer(store).toN3(store);

            console.log("Record url: " + newRecordUri);
            solidClient.web.put(newRecordUri, data).then(function (meta) {
                // view
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
    let url = 'https://lukatavcer.example.com:8443/med-app/records/record.ttl';
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
                $(`<li class="list-group-item" title="${patient.value}"><span class="badge">+</span>${nameOrUri}</li>`)
            );

            $selectPatients.append(
                $(`<option value="${patient.value}">${nameOrUri}</option>`)
            );
        });
    } else {
        $patientsLoader.hide();
    }
}