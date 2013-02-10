define(["require", "exports"], function(require, exports) {
    /// <reference path="../../_references.ts" />
    var Midi = (function () {
        function Midi(midi, params) {
            this.midi = midi;
            this.params = params;
            // denominator in time signature: 2, 4, 8, 16 ...
            this.playerTracks = [];
            this.lastVals = [
                undefined, 
                undefined, 
                undefined, 
                undefined
            ];
            var o = this;
            o.parseHeader();
            o.parsePlayerTracks();
            o.sortPlayerTracksByHands();
            o.normalizeVolumeOfPlayerTracks();
            o.computeSceneTracks();
            o.computeCleanedPlayerTracks();
            o.computeTimePerSong();
        }
        Midi.prototype.parseHeader = function () {
            var o = this;
            var i0 = Midi.indexOf(o.midi, [
                77, 
                84, 
                104, 
                100, 
                0, 
                0, 
                0, 
                6
            ]);
            if(i0 == -1 || o.midi[i0 + 9] > 1) {
                alert("cannot parse midi");
            }
            o.ticksPerQuarter = o.midi[i0 + 12] * 256 + o.midi[i0 + 13];
            if(o.ticksPerQuarter & 32768) {
                alert("ticksPerBeat not implemented");
            }
        };
        Midi.prototype.parsePlayerTracks = function () {
            var o = this;
            var trackIndexes = Midi.indexesOf(o.midi, [
                77, 
                84, 
                114, 
                107
            ]);
            trackIndexes.forEach(function (index, i) {
                o.parsePlayerTrack(i, index + 4);
            });
            if(o.playerTracks[0].length == 0) {
                o.playerTracks.shift();
            }
        };
        Midi.prototype.parsePlayerTrack = function (trackId, index) {
            var o = this, ticks = 0;
            o.playerTracks.push([]);
            var trackLength = o.midi[index++] * 256 * 256 * 256 + o.midi[index++] * 256 * 256 + o.midi[index++] * 256 + o.midi[index++];
            var end = index + trackLength;
            while(index < end) {
                var ob = o.readVarLength(index);
                index = ob.newIndex , ticks = ticks + ob.value;
                var typeChannel = o.midi[index++];
                if(typeChannel === 240) {
                    // System Exclusive Events
                    var ob1 = o.readVarLength(index);
                    index = ob1.newIndex + ob1.value;
                } else if(typeChannel === 255) {
                    // Meta
                    index = o.processMeta(index, trackId == 0 && ticks == 0);
                } else {
                    var time = ticks * o.timePerTick;
                    index = o.processMessage(trackId, index, typeChannel, time);
                }
            }
            if(trackId == 0) {
                o.timePerBeat = o.timePerQuarter * 4 / o.noteValuePerBeat;
                o.timePerTick = o.timePerQuarter / o.ticksPerQuarter;
                o.timePerBar = o.timePerBeat * o.beatsPerBar;
            }
        };
        Midi.prototype.processMeta = function (index, isBegining) {
            var o = this;
            var type = o.midi[index++];
            var ob = o.readVarLength(index);
            index = ob.newIndex;
            switch(type) {
                case 81:
                    // set tempo, length = 3
                    if(isBegining) {
                        o.timePerQuarter = (256 * 256 * o.midi[index] + 256 * o.midi[index + 1] + o.midi[index + 2]) / 1000;
                    }
                    break;
                case 88:
                    // time signature, length = 4
                    if(isBegining) {
                        o.beatsPerBar = o.midi[index];
                        o.noteValuePerBeat = Math.pow(2, o.midi[index + 1]);
                        var midiClocksPerMetronomeClick = o.midi[index + 2];
                        var thirtySecondsPer24Clocks = o.midi[index + 3];
                    }
                    break;
                case 0:
                case 1:
                case 2:
                case 3:
                case 4:
                case 5:
                case 6:
                case 7:
                case 32:
                case 33:
                case 47:
                case 84:
                case 89:
                case 127:
                default:
                    break;
            }
            return index + ob.value;
        };
        Midi.prototype.processMessage = function (trackId, index, typeChannel, time) {
            var o = this;
            if(typeChannel >> 4 > 7 && typeChannel >> 4 < 15) {
                o.lastVals[trackId] = typeChannel;
            } else if(o.lastVals[trackId]) {
                typeChannel = o.lastVals[trackId];
                index--;
            }
            var type = typeChannel >> 4;
            var channel = typeChannel - type * 16;
            switch(type) {
                case 8:
                case 9:
                    // note on
                    var noteId = o.midi[index++];
                    var velocity = o.midi[index++];
                    var on = type == 9 && velocity > 0;
                    o.playerTracks[trackId].push({
                        on: on,
                        time: time,
                        id: noteId,
                        velocity: velocity
                    });
                    break;
                case 10:
                    // note aftertouch
                    index = index + 2;
                    break;
                case 11:
                    // controller
                    var id = o.midi[index++];
                    if(id == 64) {
                        // sustain
                        var value = o.midi[index++];
                        o.playerTracks[trackId].push({
                            on: value != 0,
                            time: time,
                            velocity: value,
                            id: -1
                        });
                    } else {
                        index++;
                    }
                    break;
                case 12:
                    // program change
                    index = index + 1;
                    break;
                case 13:
                    // channel aftertouch
                    index = index + 1;
                    break;
                case 14:
                    // pitch bend
                    index = index + 2;
                    break;
                default:
                    alert("Event not implemented");
                    break;
            }
            return index;
        };
        Midi.prototype.sortPlayerTracksByHands = function () {
            var o = this;
            o.playerTracks = o.params.readOnly.f_trackIds.map(function (trackId) {
                return o.playerTracks[trackId] || [];
            });
        };
        Midi.prototype.normalizeVolumeOfPlayerTracks = function () {
            var o = this;
            if(o.params.readOnly.f_normalize) {
                var sumVelocity = 0, n = 0;
                o.playerTracks.forEach(function (notes) {
                    notes.forEach(function (note) {
                        if(note.on) {
                            n++;
                            sumVelocity += note.velocity;
                        }
                    });
                });
                var scaleVel = o.params.readOnly.f_normalize / (sumVelocity / n);
                o.playerTracks.forEach(function (notes) {
                    notes.forEach(function (note) {
                        note.velocity = Math.max(0, Math.min(127, scaleVel * note.velocity));
                    });
                });
            }
        };
        Midi.prototype.computeSceneTracks = function () {
            var o = this;
            o.sceneTracks = o.playerTracks.map(function (playerNotes) {
                var sceneNotes = [], tempNotes = {
                };
                playerNotes.forEach(function (note, i) {
                    if(note.on) {
                        if(tempNotes[note.id]) {
                            var noteScene = o.getSceneNote(tempNotes[note.id], note);
                            sceneNotes.push(noteScene);
                        }
                        tempNotes[note.id] = note;
                    } else if(!note.on) {
                        var tn = tempNotes[note.id];
                        if(tn) {
                            var noteScene = o.getSceneNote(tempNotes[note.id], note);
                            sceneNotes.push(noteScene);
                            tempNotes[note.id] = undefined;
                        }
                    }
                });
                return sceneNotes;
            });
        };
        Midi.prototype.getSceneNote = function (noteOn, noteOff) {
            return {
                timeOn: noteOn.time,
                timeOff: noteOff.time,
                id: noteOn.id,
                velocityOn: noteOn.velocity,
                velocityOff: noteOff.velocity
            };
        };
        Midi.prototype.computeCleanedPlayerTracks = function () {
            var o = this;
            o.playerTracks = o.sceneTracks.map(function (sceneNotes) {
                var notesPlayer = [];
                sceneNotes.forEach(function (note) {
                    notesPlayer.push({
                        on: true,
                        time: note.timeOn,
                        id: note.id,
                        velocity: note.velocityOn
                    });
                    notesPlayer.push({
                        on: false,
                        time: note.timeOff,
                        id: note.id,
                        velocity: note.velocityOff
                    });
                });
                return notesPlayer.sort(function (a, b) {
                    return a.time - b.time;
                });
            });
        };
        Midi.prototype.computeTimePerSong = function () {
            var o = this;
            o.timePerSong = 0;
            o.playerTracks.forEach(function (notes) {
                notes.forEach(function (note) {
                    if(note.time > o.timePerSong) {
                        o.timePerSong = note.time;
                    }
                });
            });
        };
        Midi.prototype.readVarLength = function (index) {
            var value = this.midi[index++];
            if(value & 128) {
                value = value & 127;
                do {
                    var c = this.midi[index++];
                    value = (value << 7) + (c & 127);
                }while(c & 128);
            }
            return {
                value: value,
                newIndex: index
            };
        };
        Midi.indexOf = function indexOf(where, what) {
            for(var i = 0; i < where.length; i++) {
                var found = what.every(function (whati, j) {
                    return whati == where[i + j];
                });
                if(found) {
                    return i;
                }
            }
            return -1;
        };
        Midi.indexesOf = function indexesOf(where, what) {
            var result = [];
            for(var i = 0; i < where.length; i++) {
                var found = what.every(function (whati, j) {
                    return whati == where[i + j];
                });
                if(found) {
                    result.push(i);
                }
            }
            return result;
        };
        return Midi;
    })();
    exports.Midi = Midi;    
})
//@ sourceMappingURL=_main.js.map