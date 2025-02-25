/* global history */

import * as util from './util.js'

const prefixLen = 3
const tagTypes = ['collection', 'status', 'stream', 'level', 'wg']
const unshownTagTypes = ['status']
const oldTags = [
  'status-obsoleted',
  'level-historic'
]

var tags = {} // tags and associated rfcs
var activeTags = new Map() // what tags are active
var verbose = false // whether we're showing obsolete, etc.
var words = new Map() // index of word prefixes to RFCs containing them
var keywords = new Map() // index of keyword phrases to RFCs containing them
var searchWords = [] // words the user is searching for
var allRfcs = [] // list of all RFC numbers
var rfcs = {} // RFC objects

var tagColours = {
  'stream': '#678',
  'level': '#a33',
  'wg': '#753'
}

function init () {
  util.onDone(loadDone)
  util.loadJson('tags.json', function (json) { tags = json })
  util.loadJson('rfcs.json', function (json) { rfcs = json })
}

function loadDone () {
  compute()
  tagTypes.forEach(tagType => {
    initTags(tagType, clickTagHandler)
  })
  installFormHandlers()
  loadUrl()
  window.onpopstate = back
}

function back (...args) {
  loadUrl()
  showRfcs()
}

var obsoleteTarget
var searchTarget
var deleteTarget
var form
var title

function installFormHandlers () {
  obsoleteTarget = document.getElementById('obsolete')
  obsoleteTarget.onchange = showObsoleteHandler
  searchTarget = document.getElementById('search')
  searchTarget.placeholder = 'Search titles & keywords'
  searchTarget.oninput = searchInput
  searchTarget.disabled = false
  searchTarget.focus()
  deleteTarget = document.getElementById('delete')
  deleteTarget.onclick = deleteHandler
  form = document.forms[0]
  form.onsubmit = function () { return false }
  title = document.getElementById('title')
  title.onclick = function () {
    window.location = '/'
  }
}

function compute () {
  allRfcs = Object.keys(rfcs)
  allRfcs.sort(rfcSort)
  allRfcs.forEach(rfcNum => {
    let rfc = rfcs[rfcNum]
    tagTypes.forEach(tagType => {
      let tagName = rfc[tagType]
      if (tagName) {
        if (!tags[tagType]) tags[tagType] = {}
        if (!tags[tagType][tagName]) {
          tags[tagType][tagName] = {
            'colour': '',
            'rfcs': [],
            'active': false
          }
        }
        tags[tagType][tagName].rfcs.push(rfcNum)
      }
    })
    // index titles
    searchIndex(rfc['title'].split(' '), rfcNum, words)
    searchIndex(rfc['keywords'], rfcNum, keywords)
  })
}

function initTags (tagType, clickHandler) {
  if (unshownTagTypes.includes(tagType)) return
  var targetDiv = document.getElementById(tagType)
  var tagList = tags[tagType].keys()
  tagList.sort()
  tagList.forEach(tagName => {
    let tagSpan = renderTag(tagType, tagName, targetDiv, clickHandler)
    tags[tagType][tagName].target = tagSpan
    targetDiv.appendChild(document.createTextNode(' '))
  })
}

function renderTag (tagType, tagName, target, clickHandler) {
  var tagSpan = document.createElement('span')
  var tagContent = document.createTextNode(tagName)
  var tagData = tags[tagType][tagName]
  tagSpan.appendChild(tagContent)
  tagSpan.classList.add('tag')
  tagSpan.style.backgroundColor = tagData['colour'] || tagColours[tagType] || util.genColour(tagName)
  tagSpan.style.color = util.revColour(tagSpan.style.backgroundColor)
  if (clickHandler) {
    tagSpan.onclick = clickHandler(tagType, tagName)
  } else {
    tagSpan.style.cursor = 'default'
  }
  target.appendChild(tagSpan)
  return tagSpan
}

function clickTagHandler (tagType, tagName) {
  return function (event) {
    var activeTag = activeTags.get(tagType)
    if (activeTag && activeTag !== tagName) {
      setTagActivity(tagType, activeTag, false)
    }
    var tagData = tags[tagType][tagName]
    setTagActivity(tagType, tagName, !tagData.active)
    showRfcs()
    updateUrl()
  }
}

function deleteHandler () {
  searchTarget.value = ''
  searchWords = []
  showRfcs()
  updateUrl()
}

function setTagActivity (tagType, tagName, active) {
  var change = tagType !== 'collection'
  var tagData = tags[tagType][tagName]
  tagData.active = active
  if (tagData.active === true) {
    if (change) tagData.target.className = 'tag-active'
    activeTags.set(tagType, tagName)
  } else {
    if (change) tagData.target.className = 'tag'
    activeTags.delete(tagType)
  }
}

function showRfcs () {
  var target = document.getElementById('rfc-list')
  clear(target)
  var searchedRfcs = new Set()
  var rfcList = []
  var userInput = false
  if (activeTags.size !== 0 ||
      (searchWords.length !== 0 && !isNaN(parseInt(searchWords[0]))) ||
      (searchWords.length !== 0 && searchWords[0].length >= prefixLen)) {
    userInput = true
    var taggedRfcs = listTaggedRfcs()
    searchedRfcs = listSearchedRfcs()
    var relevantRfcs = taggedRfcs.intersection(searchedRfcs)
    rfcList = Array.from(relevantRfcs)
    rfcList.sort(rfcSort)
    rfcList.forEach(item => {
      let rfcData = rfcs[item]
      renderRfc(item, rfcData, target)
    })
  }
  // tags
  if (!userInput) { // default screen
    let relevantTags = {'collection': new Set(tags['collection'].keys())}
    showTags(relevantTags, false)
  } else if (activeTags.has('collection')) { // show a collection
    showRelevantTags(relevantRfcs)
  } else if (searchWords.length === 0) { // just tags
    showRelevantTags(taggedRfcs)
  } else { // search (and possibly tags), but only worry about search terms
    showRelevantTags(searchedRfcs)
  }
  // count
  var count = document.createTextNode(rfcList.length + ' RFCs')
  var countTarget = document.getElementById('count')
  clear(countTarget)
  countTarget.appendChild(count)
  setContainer(rfcList.length > 0 || userInput)
}

function listTaggedRfcs () {
  var filteredRfcs = new Set(allRfcs)
  tags.forEach(tagType => {
    tags[tagType].forEach(tagName => {
      let tagData = tags[tagType][tagName]
      let rfcs = new Set(tagData.rfcs)
      if (tagData.active === true) {
        filteredRfcs = filteredRfcs.intersection(rfcs)
      } else if (!verbose && oldTags.includes(`${tagType}-${tagName}`)) {
        filteredRfcs = filteredRfcs.difference(rfcs)
      }
    })
  })
  return filteredRfcs
}

function listSearchedRfcs () {
  var filteredRfcs = new Set(allRfcs)
  searchWords.forEach(searchWord => {
    var padded = `RFC${searchWord.padStart(4, '0')}`
    if (padded in rfcs) {
      filteredRfcs = new Set([padded])
    } else if (searchWord.length >= prefixLen || searchWords.length === 1) {
      let wordRfcs = searchLookup(searchWord, words, 'title')
      let keywordRfcs = searchLookup(searchWord, keywords, 'keywords')
      filteredRfcs = filteredRfcs.intersection(wordRfcs.union(keywordRfcs))
    }
  })
  return filteredRfcs
}

function renderRfc (rfcName, rfcData, target) {
  var rfcSpan = document.createElement('li')
  rfcSpan.data = rfcData
  var rfcRef = document.createElement('a')
  rfcRef.className = 'reference'
  var rfcNum = rfcName.substring(3).padStart(4, '0')
  rfcRef.href = `https://www.rfc-editor.org/refs/bibxml/reference.RFC.${rfcNum}.xml`
  rfcRef.appendChild(document.createTextNode(rfcName))
  rfcSpan.appendChild(rfcRef)
  var sep = document.createTextNode(': ')
  rfcSpan.appendChild(sep)
  var rfcLink = document.createElement('a')
  rfcLink.href = 'https://tools.ietf.org/html/' + rfcName.toLowerCase()
  rfcSpan.appendChild(rfcLink)
  var rfcTitle = document.createTextNode(rfcData.title)
  rfcLink.appendChild(rfcTitle)
  if (rfcs[rfcName].stream && rfcs[rfcName].stream !== 'ietf') {
    renderTag('stream', rfcs[rfcName].stream, rfcSpan)
  }
  if (rfcs[rfcName].level && rfcs[rfcName].level !== 'std') {
    renderTag('level', rfcs[rfcName].level, rfcSpan)
  }
  target.appendChild(rfcSpan)
}

function showRelevantTags (rfcSet) {
  var relevantTags = {}
  tagTypes.forEach(tagType => {
    relevantTags[tagType] = new Set()
    var activeTag = activeTags.get(tagType)
    if (activeTag) relevantTags[tagType].add(activeTag)
  })
  rfcSet.forEach(rfcNum => {
    tagTypes.forEach(tagType => {
      let tagName = rfcs[rfcNum][tagType]
      if (!verbose && oldTags.includes(`${tagType}-${tagName}`)) {
        return
      }
      if (tagName) {
        relevantTags[tagType].add(tagName)
      }
    })
  })
  showTags(relevantTags)
}

function showTags (relevantTags, showHeader = true) {
  tagTypes.forEach(tagType => {
    if (unshownTagTypes.includes(tagType)) return
    if (!relevantTags[tagType]) {
      relevantTags[tagType] = new Set()
    }
    let header = document.getElementById(tagType + '-header')
    header.style.display = showHeader && relevantTags[tagType].size > 0 ? 'block' : 'none'
    tags[tagType].forEach(tagName => {
      let visibility = relevantTags[tagType].has(tagName) ? 'inline' : 'none'
      tags[tagType][tagName].target.style.display = visibility
    })
  })
}

function searchIndex (words, inputId, index) {
  words.forEach(word => {
    word = cleanString(word)
    if (word.length < prefixLen) {
      return
    }
    var prefix = word.substring(0, prefixLen)
    if (index.has(prefix)) {
      index.get(prefix).add(inputId)
    } else {
      index.set(prefix, new Set([inputId]))
    }
  })
}

function searchInput () {
  var searchText = document.getElementById('search').value
  searchWords = searchText.split(' ').filter(word => word)
  showRfcs()
  updateUrl()
}

function searchLookup (searchWord, index, attr) {
  searchWord = cleanString(searchWord)
  var searchPrefix = searchWord.substring(0, prefixLen)
  var matchRfcs = new Set(index.get(searchPrefix))
  if (searchWord.length > prefixLen) {
    matchRfcs.forEach(rfcNum => {
      let hit = false
      let fullItem = rfcs[rfcNum][attr]
      if (typeof (fullItem) === 'string') fullItem = fullItem.split(' ')
      fullItem.forEach(item => {
        if (cleanString(item).startsWith(searchWord)) hit = true
      })
      if (!hit) matchRfcs.delete(rfcNum)
    })
  }
  return matchRfcs
}

function showObsoleteHandler (event) {
  verbose = obsoleteTarget.checked
  showRfcs()
  updateUrl()
}

function updateUrl () {
  var queries = []
  if (searchWords.length > 0) {
    queries.push('search=' + searchWords.join('%20'))
  }
  if (verbose) {
    queries.push('obsolete')
  }
  tags.forEach(tagType => {
    var urlTags = []
    tags[tagType].forEach(tagName => {
      let tagData = tags[tagType][tagName]
      if (tagData.active === true) {
        urlTags.push(tagName)
      }
    })
    if (urlTags.length > 0) {
      queries.push(tagType + '=' + urlTags.join(','))
    }
  })
  var url = './'
  if (queries.length > 0) url += '?'
  url += queries.join('&')
  history.pushState({}, '', url)
}

function loadUrl () {
  var search = util.getParameterByName('search') || ''
  document.getElementById('search').value = search
  searchWords = search.split(' ').filter(word => word)
  if (util.getParameterByName('obsolete') !== null) {
    verbose = true
  }
  obsoleteTarget.checked = verbose
  tagTypes.forEach(tagType => {
    if (unshownTagTypes.includes(tagType)) return
    activeTags.delete(tagType)
    var tagstring = util.getParameterByName(tagType)
    var urlTagNames = new Set(tagstring ? tagstring.split(',') : [])
    tags[tagType].forEach(tagName => {
      setTagActivity(tagType, tagName, urlTagNames.has(tagName))
    })
    if (urlTagNames.size > 0) {
      activeTags.set(tagType, urlTagNames.keys().next().value)
    }
  })
  showRfcs()
}

function clear (target) {
  while (target.firstChild) {
    target.removeChild(target.firstChild)
  }
}

function setContainer (hasResults) {
  var container = document.getElementById('container')
  container.className = hasResults ? 'results' : 'noresults'
}

function cleanString (input) {
  var output = input.toLowerCase()
  return output.replace(/[\]().,?"']/g, '')
}

function rfcSort (a, b) {
  return parseInt(b.replace('RFC', '')) - parseInt(a.replace('RFC', ''))
}

util.addDOMLoadEvent(init)
