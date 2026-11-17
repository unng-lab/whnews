<script setup>
import { people } from '~/utils/data';
useHead({ title: 'Действующие лица — Life is Better' });
</script>
<template><header class="page-heading"><p class="eyebrow">Личные дела</p><h1>Действующие лица</h1><p>Правители, техножрецы и демагоги нашей вымышленной вселенной. У каждого — своё дело и своя летопись.</p></header><ActorDirectory :actors="people" /></template>
