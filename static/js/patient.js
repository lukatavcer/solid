
async function loadRecords() {
    const $recordsLoader = $('#records-loader');
    const $records = $('#records');
    $records.empty();
    $recordsLoader.show();

    const session = await solid.auth.currentSession();
    if (session) {
        const url = session.webId.split('/profile')[0] + '/health/records/';
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
            })
            .catch(function(err) {
                console.log(err) // error object
            });
    } else {
        $recordsLoader.hide();
    }
}