
$('#btn-load-records').click(function() {
    const $patientsLoader = $('#patients-loader');
    const $patients = $('#patients');
    $patients.empty();
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

        patients.forEach(async (patient) => {
            await fetcher.load(patient);
            let fullName = store.any(patient, FOAF('name'));
            let value = "<span class=\"badge\"> + </span>" + (fullName && fullName.value || patient.value);
            $patients.append(
                $('<li class="list-group-item"></li>')
                    .html(value)
                    .prop('title', patient.value)
            );
        });
    } else {
        $patientsLoader.hide();
    }
});