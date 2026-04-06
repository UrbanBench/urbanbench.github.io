// js/leaderboard.js

document.addEventListener('DOMContentLoaded', () => {
  let leaderboardData = {
    urban_map_web: [],
    urban_satellite: []
  };

  let currentDomain = 'urban_map_web';
  let sortColumn = 'pass1_eff';
  let sortDirection = 'desc';

  const tbody = document.getElementById('leaderboard-body');
  const domainButtons = document.querySelectorAll('.domain-toggle-option');
  const sortHeaders = document.querySelectorAll('.sortable');

  // Utility to parse URL query params
  const urlParams = new URLSearchParams(window.location.search);
  const domainParam = urlParams.get('domain');
  if (domainParam === 'urban_map_web' || domainParam === 'urban_satellite') {
    currentDomain = domainParam;
  }

  // Set active domain button
  domainButtons.forEach(btn => {
    if (btn.dataset.domain === currentDomain) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Fetch data
  fetch('./data/leaderboard/leaderboard.json')
    .then(res => res.json())
    .then(data => {
      leaderboardData = data;
      renderTable();
    })
    .catch(err => {
      console.error('Error loading leaderboard data:', err);
      tbody.innerHTML = `<tr><td colspan="7" style="color:red">Failed to load leaderboard data. Run the python calculate script first.</td></tr>`;
    });

  // Domain Switcher
  domainButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      domainButtons.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentDomain = e.target.dataset.domain;
      
      // Update URL without reload
      const newUrl = new URL(window.location);
      newUrl.searchParams.set('domain', currentDomain);
      window.history.pushState({}, '', newUrl);

      renderTable();
    });
  });

  // Header Sorter
  sortHeaders.forEach(th => {
    th.addEventListener('click', () => {
      const column = th.dataset.sort;
      if (sortColumn === column) {
        sortDirection = sortDirection === 'desc' ? 'asc' : 'desc';
      } else {
        sortColumn = column;
        sortDirection = 'desc';
      }
      
      // Update header UI
      sortHeaders.forEach(header => {
        header.classList.remove('active');
        let text = header.textContent.replace(' ↓', '').replace(' ↑', '');
        if (header.dataset.sort === sortColumn) {
          header.classList.add('active');
          text += sortDirection === 'desc' ? ' ↓' : ' ↑';
        }
        header.textContent = text;
      });

      renderTable();
    });
  });

  function renderTable() {
    let data = [...(leaderboardData[currentDomain] || [])];
    
    // Sort logic
    data.sort((a, b) => {
      let valA = a[sortColumn];
      let valB = b[sortColumn];
      
      if (valA === valB) return 0;
      
      const multiplier = sortDirection === 'desc' ? -1 : 1;
      return (valA < valB ? -1 : 1) * multiplier;
    });

    tbody.innerHTML = '';
    
    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="color:#64748b">No submissions found for this domain.</td></tr>`;
      return;
    }

    data.forEach((model, index) => {
      const tr = document.createElement('tr');
      
      let rankHtml = `<span class="rank-number">#${index + 1}</span>`;
      let rankClass = '';
      if (index === 0) { rankHtml = '🥇'; rankClass = 'gold-medal'; }
      else if (index === 1) { rankHtml = '🥈'; rankClass = 'silver-medal'; }
      else if (index === 2) { rankHtml = '🥉'; rankClass = 'bronze-medal'; }

      // Viewer URL: prefer source filename as model key, fallback to data_file.
      const sourceFile = model.filename || model.data_file || '';
      const fileStem = sourceFile.replace('.json', '').replace('_recorrected', '');
      const viewerUrl = currentDomain === 'urban_map_web' 
                          ? `urban-map-web.html?model=${fileStem}` 
                          : `urban-satellite.html?model=${fileStem}`;

      tr.innerHTML = `
        <td class="rank-cell ${rankClass}">${rankHtml}</td>
        <td class="model-name">${model.model_name}</td>
        <td class="metric-value"><b>${(model.pass1_eff * 100).toFixed(1)}%</b></td>
        <td class="metric-value">${(model.pass1 * 100).toFixed(1)}%</td>
        <td class="metric-value">${(model.average_process_accuracy * 100).toFixed(1)}%</td>
        <td class="metric-value">${(model.average_outcome_accuracy * 100).toFixed(1)}%</td>
        <td><a href="${viewerUrl}" style="text-decoration:none; color:#0ea5e9; font-weight:600;">View Trajectories &rarr;</a></td>
      `;
      
      tbody.appendChild(tr);
    });
  }

});
