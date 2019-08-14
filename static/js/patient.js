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
        await loadRecords();

        // Use the user's WebID as default profile
        const $profile = $('#profile');
        if (!$profile.val()) {
            $profile.val(session.webId);
        }
    }
});

async function loadRecords() {
    const $recordsLoader = $('#records-loader');
    const $records = $('#records');
    $records.empty();
    $recordsLoader.show();

    const session = await solid.auth.currentSession();
    if (session) {
        const url = LoggedUser.storage + 'health/records/';
        solidClient.web.get(url)
            .then(function(response) {
                const store = $rdf.graph();
                const fetcher = new $rdf.Fetcher(store);

                // Dictionary of images of doctors that wrote medical records
                let doctors = {};

                $recordsLoader.hide();
                // TODO sort by datetime created
                response.contentsUris.forEach(async (resource) => {
                    let record = $rdf.sym(resource);
                    await fetcher.load(resource);
                    let title = store.any(SIOC('Post'), DCT('title'), undefined, record).value;
                    let content = store.any(SIOC('Post'), SIOC('content'), undefined, record).value;
                    let created = store.any(SIOC('Post'), DCT('created'), undefined, record).value;
                    let doctorWebId = store.any(SIOC('Post'), DCT('creator'), undefined, record).value;

                    // Get creators data (name, image...)
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