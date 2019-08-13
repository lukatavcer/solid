
async function loadRecords() {
    const $recordsLoader = $('#patients-records');
    const $records = $('#records');
    $records.empty();
    $recordsLoader.show();

    const session = await solid.auth.currentSession();
    if (session) {
        const url = session.webId.split('/profile')[0] + '/med-app/records/';
        solidClient.web.get(url)
            .then(function(response) {
                const store = $rdf.graph();
                const fetcher = new $rdf.Fetcher(store);


                response.contentsUris.forEach(async (resource) => {
                    let record = $rdf.sym(resource);
                    await fetcher.load(resource);
                    let title = store.any(SIOC('Post'), DCT('title'), undefined, record).value;
                    let content = store.match(SIOC('Post'), SIOC('content'), record).value;
                    let created = store.any(SIOC('Post'), DCT('created'), undefined, record).value;
                    let creator = store.any(SIOC('Post'), DCT('creator'), undefined, record).value;

                    $records.append(
                        $(`
                        <div class="media">
                            <div class="media-left">
                                <a href="#">
                                    <img class="media-object" data-src="favicon.ico" alt="64x64" src="/favicon.ico" data-holder-rendered="true" style="width: 64px; height: 64px;">
                                </a>
                            </div>
                            <div class="media-body">
                                <h4 class="media-heading">${title}</h4>  ${creator} - (${created})
                                ${content})
                            </div>
                        </div>
                        `)
                    );
                });
                // // Print all statements matching resources of type foaf:Post
                // console.log(graph.statementsMatching(undefined, RDF('type'), SIOC('Post')))
            })
            .catch(function(err) {
                console.log(err) // error object
            });

        // Fetch patients into the store
        // await fetcher.load(url);
        // const records = store.each(patientGroup, VCARD('hasMember'));  // (subject, predicate, object, document)
        //
        // // Display patients
        // $recordsLoader.hide();
        //
        // patients.forEach(async (patient) => {
        //     await fetcher.load(patient);
        //     let fullName = store.any(patient, FOAF('name'));
        //     let value = "<span class=\"badge\"> + </span>" + (fullName && fullName.value || patient.value);
        //     $patients.append(
        //         $('<li class="list-group-item"></li>')
        //             .html(value)
        //             .prop('title', patient.value)
        //     );
        // });
    } else {
        $recordsLoader.hide();
    }
}