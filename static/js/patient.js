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

        // Load patient's rights
        await loadRights();

        // Use the user's WebID as default profile
        const $profile = $('#profile');
        if (!$profile.val()) {
            $profile.val(session.webId);
        }
    }
});

function loadRecords() {
    const url = LoggedUser.storage + 'health/records/';
    _loadRecords(url);
}

$('#records').on('click', '.media', function() {
    let $aclUsers = $('#acl-users');
    $aclUsers.empty();

    let uri = this.id;
    let record = recordsData[uri];
    $('#record-uri').val(uri);
    $('#edit-title').text(record.title);
    $('#edit-author').text(record.doctor);
    $('#edit-content').val(record.content);

    solidClient.getPermissions(uri)
        .then(function (permissionSet) {
            permissionSet.forEach(function (auth) {
                if (auth.virtual)
                    return;

                // TODO fix this
                // Hardcoded just to fix groups by showing
                // Note: auth.isGroup() not working for groups!
                if (auth.agent.indexOf("groups.ttl") > -1)
                    return;

                // Prevent user from changing his own access rights, to prevent him from locking his own data
                if (auth.webId() === LoggedUser.webId)
                    return;

                if (auth.isAgent()) {
                    console.log('agent webId: ' + auth.agent)
                } else if (auth.isPublic()) {
                    // this permission is for everyone (acl:agentClass foaf:Agent)
                    return;
                } else if (auth.isGroup()) {
                    console.log('GROUP agentClass webId: ' + auth.group)
                    return;
                }

                let read, write, append = '';
                if (auth.allowsRead()) read = 'checked';
                if (auth.allowsWrite()) write = 'checked';
                if (auth.allowsAppend()) append = 'checked';

                $aclUsers.append(
                    `<li class="list-group-item">
                        <span class="acl-webId">${auth.webId()}</span>
                        <span class="float-right">
                            <label>R</label>
                            <input type="checkbox" name="acl-read" ${read}>
                            <label>W</label>
                            <input type="checkbox" name="acl-write" ${write}>
                            <label>A</label>
                            <input type="checkbox" name="acl-append" ${append}>
                        </span>
                    </li>`
                );
            });

            $('#edit-record-modal').modal('show');
        });
});

$('#acl-add').click(function() {
    let $aclUsers = $('#acl-users');
    let $newUser = $('#acl-new-user');

    $aclUsers.append(
        `<li class="list-group-item">
            <span class="acl-webId">${$newUser.val()}</span>
            <span class="float-right">
                <label>R</label>
                <input type="checkbox" name="acl-read" checked>
                <label>W</label>
                <input type="checkbox" name="acl-write">
                <label>A</label>
                <input type="checkbox" name="acl-append">
            </span>
        </li>`
    );
    $newUser.val('');
    $(this).blur();
});

const ACL_RIGHTS = {
    r: 'acl:Read',
    w: 'acl:Write',
    a: 'acl:Append',
    rw: 'acl:Read, acl:Write',
    ra: 'acl:Read, acl:Append',
    wa: 'acl:Write, acl:Append',
    rwa: 'acl:Read, acl:Write, acl:Append',
};

$('#edit-record').click(async function() {
    let recordUri = $('#record-uri').val();
    const recordAclUrl = recordUri + '.acl';

    let content =
        `@prefix  acl:  <http://www.w3.org/ns/auth/acl#>.

# The owner has all of the access modes allowed
<#owner>
    a acl:Authorization;
    acl:agent <${LoggedUser.webId}>;
    acl:accessTo <${recordUri}>;
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

    let count = 1;

    for (let li of $('#acl-users li')) {
        let $li = $(li);
        let uri = $li.find('.acl-webId').text();

        let read = $li.find('input[name="acl-read"]').prop('checked');
        let write = $li.find('input[name="acl-write"]').prop('checked');
        let append = $li.find('input[name="acl-append"]').prop('checked');
        if (!read && !write && !append)
            continue;

        let rights = '';
        if (read) rights += 'r';
        if (write) rights += 'w';
        if (append) rights += 'a';

        content +=
            `<#authorization${count}>
    a acl:Authorization;
    acl:agent <${uri}>;
    acl:accessTo <${recordUri}>;
    acl:mode
        ${ACL_RIGHTS[rights]}.
        
`;

        count++;

    }
    await solidClient.web.put(recordAclUrl, content).then(function (meta) {
        $('#edit-record-modal').modal('hide');
        return meta.url;
    }).catch(function (err) {
        alert("Nekaj je šlo narobe. " + err);
        console.log(err);
    });
});

async function loadRights() {
    const $rightsLoader = $('#rights-loader');
    $rightsLoader.show();
    const healthUrl = LoggedUser.storage + 'health/';
    const healthProfileUrl = healthUrl + 'profile.ttl';
    const resource = $rdf.sym(healthProfileUrl);

    const store = $rdf.graph();
    const fetcher = new $rdf.Fetcher(store);
    await fetcher.load(healthProfileUrl).catch(async function(e) {
        await solidClient.web.put(healthProfileUrl).then(function (meta) {
            return meta.url;
        });
    });

    let personalDoctor = null;
    let specialists = null;

    // Get all records from patient's data pod
    await fetchHealthProfile();

    solidClient.getPermissions(healthUrl)
        .then(function (permissionSet) {
            // Emergency rights
            let $emergencyRights = $('#emergency-rights');
            let auth = permissionSet.permissionFor("https://example.com:8443/groups.ttl#Emergency");
            if (auth.allowsRead()) $emergencyRights.find('input[name="acl-read"]').prop('checked', 'checked');
            if (auth.allowsWrite()) $emergencyRights.find('input[name="acl-write"]').prop('checked', 'checked');
            if (auth.allowsAppend()) $emergencyRights.find('input[name="acl-append"]').prop('checked', 'checked');

            // Personal doctor
            if (personalDoctor) {
                $('#personal-doctor').text(personalDoctor.object.value);
                $('#current-doctor-uri').val(personalDoctor.object.value);  // On change personal doctor modal
                let auth = permissionSet.permissionFor(personalDoctor.object.value);
                let $rights = $('#personal-doctor-rights');

                if (auth.allowsRead()) $rights.find('input[name="acl-read"]').prop('checked', 'checked');
                if (auth.allowsWrite()) $rights.find('input[name="acl-write"]').prop('checked', 'checked');
                if (auth.allowsAppend()) $rights.find('input[name="acl-append"]').prop('checked', 'checked');
            }

            $rightsLoader.hide();
            $('#rights-wrapper').show();

            // Specialists
            const $specialists = $('#specialist-rights');
            specialists.forEach(function (specialist) {
                console.log("Specialist: " + specialist.object.value);
                let auth = permissionSet.permissionFor(specialist.object.value);

                let read, write, append = '';
                if (auth) {
                    if (auth.allowsRead()) read = 'checked';
                    if (auth.allowsWrite()) write = 'checked';
                    if (auth.allowsAppend()) append = 'checked';
                }

                $specialists.prepend(
                    `<li class="list-group-item">
                        <span class="acl-webId">${specialist.object.value}</span>
                        <span class="float-right">
                            <label>R</label>
                            <input type="checkbox" name="acl-read" ${read}>
                            <label>W</label>
                            <input type="checkbox" name="acl-write" ${write}>
                            <label>A</label>
                            <input type="checkbox" name="acl-append" ${append}>
                        </span>
                    </li>`
                );
            });

        });

    async function fetchHealthProfile() {
        personalDoctor = store.anyStatementMatching(undefined, $rdf.blankNode("personalDoctor"), undefined, resource);
        specialists = store.match(undefined, $rdf.blankNode("specialist"), undefined, resource);
    }

}

async function saveRights() {
    const healthContainer = LoggedUser.storage + 'health/'
    const healthAcl = healthContainer + '.acl';

    let content =
        `@prefix  acl:  <http://www.w3.org/ns/auth/acl#>.

# The owner has all of the access modes allowed
<#owner>
    a acl:Authorization;
    acl:agent <${LoggedUser.webId}>;
    acl:accessTo <./>;
    acl:default <./>;
    acl:mode
        acl:Read, acl:Write, acl:Control.


`;
    // Set emergency rights
    let $emergencyRights = $('#emergency-rights');
    let read = $emergencyRights.find('input[name="acl-read"]').prop('checked');
    let write = $emergencyRights.find('input[name="acl-write"]').prop('checked');
    let append = $emergencyRights.find('input[name="acl-append"]').prop('checked');
    if (read || write || append) {
        let rights = '';
        if (read) rights += 'r';
        if (write) rights += 'w';
        if (append) rights += 'a';

        content +=
            `<#emergency>
    a acl:Authorization;
    acl:accessTo <./>;
    acl:default <./>;
    acl:mode
        ${ACL_RIGHTS[rights]};
    acl:agentGroup  <https://example.com:8443/groups.ttl#Emergency>.
        
`;
    }

    // Set personal doctor's rights
    let $personalDoctorRights = $('#personal-doctor-rights');

    read = $personalDoctorRights.find('input[name="acl-read"]').prop('checked');
    write = $personalDoctorRights.find('input[name="acl-write"]').prop('checked');
    append = $personalDoctorRights.find('input[name="acl-append"]').prop('checked');
    if (read || write || append) {
        let rights = '';
        if (read) rights += 'r';
        if (write) rights += 'w';
        if (append) rights += 'a';

        content +=
            `<#personalDoctor>
    a acl:Authorization;
    acl:agent <${$('#personal-doctor').text()}>;
    acl:accessTo <./>;
    acl:default <./>;
    acl:mode
        ${ACL_RIGHTS[rights]}.
        
`;
    }

    // Set specialists rights
    let count = 1;

    for (let li of $('#specialist-rights li')) {
        let $li = $(li);
        let uri = $li.find('.acl-webId').text();

        let read = $li.find('input[name="acl-read"]').prop('checked');
        let write = $li.find('input[name="acl-write"]').prop('checked');
        let append = $li.find('input[name="acl-append"]').prop('checked');
        if (!read && !write && !append)
            continue;

        let rights = '';
        if (read) rights += 'r';
        if (write) rights += 'w';
        if (append) rights += 'a';

        content +=
            `<#specialist${count}>
    a acl:Authorization;
    acl:agent <${uri}>;
    acl:accessTo <./>;
    acl:default <./>;
    acl:mode
        ${ACL_RIGHTS[rights]}.
        
`;

        count++;

    }
    await solidClient.web.put(healthAcl, content).then(function (meta) {
        $('#save-rights-success').show();
        return meta.url;
    }).catch(function (err) {
        alert("Nekaj je šlo narobe. " + err);
        console.log(err);
    });
}

$('#change-doctor-save').click(function() {
    let newDoctorUri = $('#current-doctor-uri').val();

    if (!newDoctorUri)
        alert("Vrednost za novega zdravnika ne more biti prazna.");

    let url = LoggedUser.storage + 'health/profile.ttl';
    let specialists = '';
    let list = $('#specialist-rights li');

    for (let i=0; i<list.length; i++) {
        specialists += `<${$(list[i]).find('.acl-webId').text()}>`

        if (i < list.length-1)
            specialists += ',\n\t\t\t\t ';
    }

    let content =
        `@prefix : <#>.

:me
    _:personalDoctor <${newDoctorUri}>`;

    if (specialists) {
        content += `\n\t_:specialist ${specialists}`
    } else {
        content += '.\n';
    }

    solidClient.web.put(url, content)
        .then(async function (response){
            $('#personal-doctor').text(newDoctorUri);
            let $doctor = $('#personal-doctor-rights');
            $doctor.find('input[name="acl-read"]').prop('checked', 'checked');
            $doctor.find('input[name="acl-write"]').prop('checked', 'checked');
            $doctor.find('input[name="acl-append"]').prop('checked', 'checked');

            await saveRights();

            $('#change-doctor-modal').modal('hide');
        })
        .catch(function(err) {
            console.log(err) // error object
        })

});