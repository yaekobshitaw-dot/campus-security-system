import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getServerBaseUrl } from '../config/server';

const normalizePhotos = (photos) => {
    if (Array.isArray(photos)) return photos;
    if (typeof photos !== 'string' || !photos.trim()) return [];
    try {
        const parsed = JSON.parse(photos);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const getEvidenceUri = (incidentId, reference) => {
    if (typeof reference !== 'string' || !incidentId) return null;
    const prefix = `/api/incidents/${encodeURIComponent(incidentId)}/evidence/`;
    const filename = reference.startsWith(prefix) ? reference.slice(prefix.length) : '';
    if (!filename || filename.includes('/') || filename.includes('\\')) return null;
    try {
        return new URL(reference, `${getServerBaseUrl()}/`).toString();
    } catch {
        return null;
    }
};

const IncidentEvidence = ({ incidentId, photos }) => {
    const [token, setToken] = useState(null);
    const references = normalizePhotos(photos)
        .map((photo) => getEvidenceUri(incidentId, photo))
        .filter(Boolean);

    useEffect(() => {
        let active = true;
        AsyncStorage.getItem('auth_token')
            .then((value) => { if (active) setToken(value); })
            .catch(() => undefined);
        return () => { active = false; };
    }, []);

    if (!references.length) return null;

    return ( <View style = { styles.container } >
        <Text style = { styles.heading } > Evidence </Text> <ScrollView horizontal showsHorizontalScrollIndicator = { false }
        contentContainerStyle = { styles.photos } > {
            references.map((uri) => token ? ( <Image key = { uri }
                source = {
                    { uri, headers: { Authorization: `Bearer ${token}` } } }
                style = { styles.image }
                accessibilityLabel = "Incident evidence photo"/>
            ) : null)
        } </ScrollView> </View>
    );
};

const styles = StyleSheet.create({
    container: { marginTop: 22 },
    heading: { marginBottom: 8, color: '#8A9698', fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
    photos: { gap: 8 },
    image: { width: 112, height: 112, borderRadius: 8, backgroundColor: '#E8EFEC' },
});

export default IncidentEvidence;