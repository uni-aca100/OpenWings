/* leaflet setup */
const map = L.map('map').setView([51.505, -0.09], 4);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

// Fetch GeoJSON data about observation points and update the map
// for each observation, create a marker with a popup showing species name, approval status, and observation date
const observationPointsHandler = {
  lastLayer: null,

  fetchAndUpdateGeoJSON() {
    fetch('/api/user/observations', {
      method: 'POST'
    })
      .then(response => response.json())
      .then(data => {
        if (!data || data.error) {
          console.log('Invalid GeoJSON data received');
          return;
        }
        // Remove the previous layer if it exists, preventing map clutter
        if (this.lastLayer) {
          map.removeLayer(this.lastLayer);
        }
        this.lastLayer = L.geoJSON(data, {
          // for each feature, bind a popup with relevant information
          onEachFeature: (feature, layer) => {
            layer.bindPopup(`<em>species:</em> ${feature.properties.speciesName} <br />
                                   <em>approved:</em> ${feature.properties.approved} <br />
                                   <em>observed at:</em> ${new Date(feature.properties.observedAt).toLocaleDateString()}`);
          }
        });
        this.lastLayer.addTo(map); // add the new layer to the map
      }).catch(error => {
        console.error('Error fetching observation points:', error);
      });
  }
};

// Fetch user information and update the profile display
// the only info we need is the username 
const userInfoHandler = {
  fetchAndUpdateUserInfo() {
    fetch('/api/user', {
      method: 'POST'
    })
      .then(response => response.json())
      .then(data => {
        document.getElementById('js-username').textContent = data.username;
      });
  },
};

// Fetch challenge list and update the challenge standings display
const challengeListHandler = {
  fetchAndUpdateChallengeList() {
    fetch('/api/user/challenges', {
      method: 'POST'
    })
      .then(response => response.json())
      .then(data => {
        // insert the challenge standings fetched to the page
        if (data && data.length > 0) {
          this.insertChallengeStandings(data);
        } else {
          console.log('No challenges found for the user.');
        }
      }).catch(error => {
        console.error('Error fetching challenge list:', error);
      });
  },

  // handling the dynamic insertion of the challenge standings to the page
  // splitting the ongoing and ended challenges
  // and order the participants by total score descending
  insertChallengeStandings(data) {
    // sort participants by score descending for each challenge
    data.forEach(challenge => {
      challenge.participants.sort((a, b) => b.score - a.score);
    });
    // select the hooks for ongoing and ended challenges
    const ongoing = document.getElementById('js-standings-ongoing-wrapper');
    const ended = document.getElementById('js-standings-ended-wrapper');
    ongoing.innerHTML = ''; // clear previous content
    ended.innerHTML = ''; // clear previous content
    // insert ongoing and ended challenges separately on separated sections
    this.insertChallengeStandingsToElement(data.filter(challenge => !challenge.ended), ongoing);
    this.insertChallengeStandingsToElement(data.filter(challenge => challenge.ended), ended);
  },

  // handling the dynamic insertion of the challenge standings to the given wrapper element
  // for each challenge add a table to the standings wrapper
  insertChallengeStandingsToElement(data, standingsWrapper) {
    // the templates for challenge and participant rows, used for cloning and inserting data
    const challengeTemplate = document.getElementById('js-challenge-standings-template');
    const participantTemplate = document.getElementById('js-participant-standings-template');

    data.forEach(challenge => {
      // clone the challenge (table with info) template and fill in the data
      const challengeClone = challengeTemplate.content.cloneNode(true);
      challengeClone.querySelector('.challenge-name').textContent = challenge.challengeName;
      challengeClone.querySelector('.challenge-start-date').textContent = new Date(challenge.startDate).toLocaleDateString();
      challengeClone.querySelector('.challenge-end-date').textContent = new Date(challenge.endDate).toLocaleDateString();
      // select the participants wrapper inside the cloned challenge table
      // where to insert the participant rows
      const participantsWrapper = challengeClone.querySelector('.standings-body');

      challenge.participants.forEach(participant => {
        // clone the participant row template and fill in the data
        const participantClone = participantTemplate.content.cloneNode(true);
        participantClone.querySelector('.participant-username').textContent = participant.username;
        participantClone.querySelector('.participant-total-score').textContent = participant.score;
        participantClone.querySelector('.participant-lc-score').textContent = participant.lcScore;
        participantClone.querySelector('.participant-nt-score').textContent = participant.ntScore;
        participantClone.querySelector('.participant-vu-score').textContent = participant.vuScore;
        participantClone.querySelector('.participant-en-score').textContent = participant.enScore;
        participantClone.querySelector('.participant-cr-score').textContent = participant.crScore;
        // append the participant row to the participants wrapper
        participantsWrapper.appendChild(participantClone);
      });

      // append the challenge card after all participants are added to the standing location in the page
      standingsWrapper.appendChild(challengeClone);
    });

  }
};

// Initialize the profile page information
observationPointsHandler.fetchAndUpdateGeoJSON();
userInfoHandler.fetchAndUpdateUserInfo();
challengeListHandler.fetchAndUpdateChallengeList();

// Modal handling for inserting new observation
const insertObservationBtn = document.getElementById('js-insert-observation');
const insertObservationModal = document.getElementById('js-insert-observation-modal');
const modalCloseBtn = insertObservationModal.querySelector('.modal-close-btn');
const observationForm = insertObservationModal.querySelector('form');

insertObservationBtn.addEventListener('click', () => {
  // open the modal to insert Observations
  insertObservationModal.showModal();
});

modalCloseBtn.addEventListener('click', (e) => {
  // close the modal to insert Observations
  e.preventDefault();
  insertObservationModal.close();
});

observationForm.addEventListener('submit', (event) => {
  event.preventDefault();
  // gather the form data and prepare the JSON payload to send to the server
  const formData = new FormData(observationForm);
  const observationData = {
    species: formData.get('species'),
    latitude: parseFloat(formData.get('latitude')),
    longitude: parseFloat(formData.get('longitude')),
    observedAt: new Date(formData.get('observedAt')).toISOString()
  };

  fetch('/api/user/observations/new', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(observationData)
  })
    .then(response => response.json())
    .then(data => {
      // Refresh the observation points on the map
      observationPointsHandler.fetchAndUpdateGeoJSON();
      insertObservationModal.close(); // Close the modal
    })
    .catch(error => {
      console.error('Error submitting observation:', error);
    });
});

// Modal handling for creating new challenge
const createChallengeBtn = document.getElementById('js-create-challenge');
const createChallengeModal = document.getElementById('js-create-challenge-modal');
const challengeModalCloseBtn = createChallengeModal.querySelector('.modal-close-btn');
const challengeForm = createChallengeModal.querySelector('form');

createChallengeBtn.addEventListener('click', () => {
  createChallengeModal.showModal(); // open the modal to create a new challenge
});

challengeModalCloseBtn.addEventListener('click', (e) => {
  // close the modal to create a new challenge
  e.preventDefault();
  createChallengeModal.close();
});

challengeForm.addEventListener('submit', (event) => {
  event.preventDefault();
  // gather the form data and prepare the JSON payload to send to the server
  const formData = new FormData(challengeForm);
  const challengeData = {
    name: formData.get('name'),
    startDate: new Date(formData.get('startDate')).toISOString(),
    endDate: new Date(formData.get('endDate')).toISOString(),
    points: {
      lc: parseFloat(formData.get('lcPoints')),
      nt: parseFloat(formData.get('ntPoints')),
      vu: parseFloat(formData.get('vuPoints')),
      en: parseFloat(formData.get('enPoints')),
      cr: parseFloat(formData.get('crPoints'))
    }
  };
  // validate date range before submitting
  if (challengeData.startDate >= challengeData.endDate || Date.now() >= challengeData.endDate || Date.now() >= challengeData.startDate) {
    alert('Invalid date range for the challenge.');
    return;
  }

  // send the challenge data to the server
  fetch('/api/user/challenges/new', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(challengeData)
  })
    .then(response => response.json())
    .then(data => {
      // Refresh the challenge list
      challengeListHandler.fetchAndUpdateChallengeList();
      // Close the modal
      createChallengeModal.close();
    })
    .catch(error => {
      console.error('Error submitting challenge:', error);
    });
});

// Modal handling for inviting user to a challenge
const inviteUserBtn = document.getElementById('js-invite-user');
const inviteUserModal = document.getElementById('js-invite-user-modal');
const inviteModalCloseBtn = inviteUserModal.querySelector('.modal-close-btn');
const inviteForm = inviteUserModal.querySelector('form');

inviteUserBtn.addEventListener('click', () => {
  inviteUserModal.showModal(); // open the modal to invite a user
});

inviteModalCloseBtn.addEventListener('click', (e) => {
  // close the modal to invite a user
  e.preventDefault();
  inviteUserModal.close();
});

inviteForm.addEventListener('submit', (event) => {
  event.preventDefault();
  // gather the form data and prepare the JSON payload to send to the server
  const formData = new FormData(inviteForm);
  const inviteData = {
    challenge: formData.get('challenge'),
    username: formData.get('username')
  };
  // send the invite data to the server
  fetch('/api/user/challenges/invite', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(inviteData)
  })
    .then(response => response.json())
    .then(data => {
      // Handle successful invitation, presumably
      inviteUserModal.close();
    })
    .catch(error => {
      console.error('Error inviting user:', error);
    });
});

// Modal handling for viewing challenge invitations
const viewInvitationsBtn = document.getElementById('js-view-invitations');
const viewInvitationsModal = document.getElementById('js-view-invitations-modal');
const invitationsModalCloseBtn = viewInvitationsModal.querySelector('.modal-close-btn');
const invitationsWrapper = viewInvitationsModal.querySelector('#js-invitations-list');

// handle accept/decline invitation button clicks sending the response to the server
// accepting or declining an invitation will refresh the invitations list
invitationsWrapper.addEventListener('click', (event) => {
  const target = event.target;
  if (target.classList.contains('btn-invitation-accept')) {
    // accept invitation button clicked
    const challengeName = target.getAttribute('data-challenge');
    respondToInvitation(challengeName, true);
  } else if (target.classList.contains('btn-invitation-decline')) {
    // decline invitation button clicked
    const challengeName = target.getAttribute('data-challenge');
    respondToInvitation(challengeName, false);
  }
});

// function to fetch and display challenge invitations in the modal
// called when opening the invitations modal
function fetchAndDisplayInvitations() {
  // fetch and display challenge invitations when opening the modal
  fetch('/api/user/challenges/invitations', {
    method: 'POST'
  })
    .then(response => response.json())
    .then(data => {
      // clear previous invitations
      invitationsWrapper.innerHTML = '';
      if (data && data.length > 0) {
        data.forEach(invitation => {
          const InvitationTemplate = document.getElementById('js-invitation-template');
          const invitationDiv = InvitationTemplate.content.cloneNode(true);
          invitationDiv.querySelector('.invitation-challenge-name').textContent = invitation.challengeName;
          invitationDiv.querySelector('.invitation-challenge-start-date').textContent = new Date(invitation.startDate).toLocaleDateString();
          invitationDiv.querySelector('.invitation-challenge-end-date').textContent = new Date(invitation.endDate).toLocaleDateString();
          invitationDiv.querySelector('.btn-invitation-accept').setAttribute('data-challenge', invitation.challengeName);
          invitationDiv.querySelector('.btn-invitation-decline').setAttribute('data-challenge', invitation.challengeName);
          invitationsWrapper.appendChild(invitationDiv);
        });
      } else {
        invitationsWrapper.innerHTML = '<p>No pending invitations.</p>';
      }
      viewInvitationsModal.showModal(); // open the modal to view invitations
    })
    .catch(error => {
      console.error('Error fetching invitations:', error);
    });
}

// open the modal to view challenge invitations
// and insert the invitations fetched from the server
viewInvitationsBtn.addEventListener('click', () => {
  fetchAndDisplayInvitations();
});

// close the modal to view challenge invitations
invitationsModalCloseBtn.addEventListener('click', (e) => {
  // close the modal to view invitations
  e.preventDefault();
  viewInvitationsModal.close();
});

// function to respond to a challenge invitation, sending acceptance or decline to the server
function respondToInvitation(challengeName, response) {
  fetch('/api/user/challenges/invite/respond', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ challengeName, response })
  })
    .then(response => response.json())
    .then(data => {
      // refresh the invitations list after responding
      fetchAndDisplayInvitations();
      // refresh the challenge list in case of acceptance
      if (response) {
        challengeListHandler.fetchAndUpdateChallengeList();
      }
    })
    .catch(error => {
      console.error('Error responding to invitation:', error);
    });
}