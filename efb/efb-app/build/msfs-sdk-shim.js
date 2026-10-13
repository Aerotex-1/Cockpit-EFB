// Wie in der offiziellen EFB-Vorlage: Das MSFS-SDK kommt vom Sim als globale Variable "msfssdk".
// Zugriff über den Namen selbst (nicht über window), damit es auch klappt, wenn der Sim sie mit let/const anlegt.
/* global msfssdk */
module.exports = typeof msfssdk !== 'undefined' ? msfssdk : globalThis.msfssdk;
