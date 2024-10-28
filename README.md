# Cortado

![lint workflow](https://github.com/cortado-tool/cortado/actions/workflows/lint.yml/badge.svg)
![test workflow](https://github.com/cortado-tool/cortado/actions/workflows/test.yml/badge.svg)

<img width="64" src="src/frontend/src/assets/icons/png/64x64.png" alt="Cortado Logo"/>

**Cortado is a process mining tool dedicated for interactive/incremental process discovery**

This is a fork of the main repository implementing **UNFOLDING-BASED ALIGNMENTS** - a work within a Master's thesis on - '_Partial Order-based Alignments via Petri net Unfolding_'

It replaces the sequentialization-based conformance checking in Cortado with unfolding-based alignments along with additional features. 

Internally uses forks of 
- [cortado-core](https://github.com/ariba-work/cortado-core), which implements the main unfolding algorithms - ERV[|>c] (baseline), ERV[|>c] (improved) and ERV[|>h] and,
- [pm4py-core](https://github.com/ariba-work/pm4py-core/tree/unfolding) which supports the data structures used during unfolding. 

## Overview Functionality

- Variant-wise interactive visualisation of missing and undesired events and dependencies
- Order-aware conformance status
- Number of _completely_ fitting traces and variants

## Repository Structure 

All the relevant changes for unfolding-based alignments can be found in https://github.com/cortado-tool/cortado/compare/main...ariba-work:cortado:main

## Setup

see [https://github.com/cortado-tool/cortado](https://github.com/cortado-tool/cortado?tab=readme-ov-file#setup)


